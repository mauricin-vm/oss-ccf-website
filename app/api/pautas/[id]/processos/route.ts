import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para modificar pautas' },
        { status: 403 }
      )
    }

    const { id: pautaId } = await params
    const { processoId, relator } = await request.json()

    if (!processoId) {
      return NextResponse.json(
        { error: 'ID do processo é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a pauta existe e está aberta
    const pauta = await prisma.pauta.findUnique({
      where: { id: pautaId },
      include: {
        processos: true
      }
    })

    if (!pauta) {
      return NextResponse.json({ error: 'Pauta não encontrada' }, { status: 404 })
    }

    if (pauta.status !== 'aberta') {
      return NextResponse.json(
        { error: 'Apenas pautas abertas podem ser modificadas' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        contribuinte: true
      }
    })

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    // Verificar se o processo já está na pauta
    const processoJaNaPauta = pauta.processos.find(p => p.processoId === processoId)
    if (processoJaNaPauta) {
      return NextResponse.json(
        { error: 'Processo já está incluído nesta pauta' },
        { status: 400 }
      )
    }

    // Verificar se o processo pode ser incluído (deve estar EM_ANALISE)
    if (processo.status !== 'EM_ANALISE') {
      return NextResponse.json(
        { error: 'Apenas processos em análise podem ser incluídos em pautas' },
        { status: 400 }
      )
    }

    // Obter a próxima ordem na pauta
    const proximaOrdem = pauta.processos.length > 0 
      ? Math.max(...pauta.processos.map(p => p.ordem)) + 1 
      : 1

    await prisma.$transaction(async (tx) => {
      // Incluir processo na pauta
      await tx.processoPauta.create({
        data: {
          pautaId,
          processoId,
          ordem: proximaOrdem,
          relator: relator?.trim() || null
        }
      })

      // Atualizar status do processo
      await tx.processo.update({
        where: { id: processoId },
        data: { status: 'EM_PAUTA' }
      })

      // Criar histórico no processo
      const distribucaoInfo = relator ? ` - Distribuído para: ${relator}` : ''
      await tx.historicoProcesso.create({
        data: {
          processoId,
          usuarioId: user.id,
          titulo: 'Processo incluído em pauta',
          descricao: `Processo incluído na ${pauta.numero} agendada para ${pauta.dataPauta.toLocaleDateString('pt-BR')}${distribucaoInfo}`,
          tipo: 'STATUS_CHANGE'
        }
      })

      // Criar tramitação para o processo (apenas se houver distribuição)
      if (relator) {
        await tx.tramitacao.create({
          data: {
            processoId,
            usuarioId: user.id,
            setorOrigem: 'CCF',
            setorDestino: relator, // Nome da pessoa (conselheiro)
            // Remover dataRecebimento - tramitação não deve ser marcada como concluída automaticamente
            observacoes: `Processo distribuído na ${pauta.numero} para julgamento em ${pauta.dataPauta.toLocaleDateString('pt-BR')}`
          }
        })
      }

      // Criar histórico na pauta
      const pautaDistribucaoInfo = relator ? ` - Distribuído para: ${relator}` : ''
      await tx.historicoPauta.create({
        data: {
          pautaId,
          usuarioId: user.id,
          titulo: 'Processo adicionado',
          descricao: `Processo ${processo.numero} incluído na pauta${pautaDistribucaoInfo}`,
          tipo: 'PROCESSO_ADICIONADO'
        }
      })
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'ProcessoPauta',
        entidadeId: `${pautaId}-${processoId}`,
        dadosNovos: {
          pautaId,
          processoId,
          ordem: proximaOrdem,
          pautaNumero: pauta.numero,
          processoNumero: processo.numero,
          contribuinte: processo.contribuinte.nome
        }
      }
    })

    return NextResponse.json({ 
      message: 'Processo incluído na pauta com sucesso',
      processoPauta: {
        pautaId,
        processoId,
        ordem: proximaOrdem
      }
    })
  } catch (error) {
    console.error('Erro ao incluir processo na pauta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: pautaId } = await params

    // Buscar processos disponíveis (EM_ANALISE e não estão em nenhuma pauta)
    const processosDisponiveis = await prisma.processo.findMany({
      where: {
        status: 'EM_ANALISE',
        pautas: {
          none: {}
        }
      },
      include: {
        contribuinte: {
          select: {
            nome: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Converter valores Decimal para number antes de retornar
    const processosDisponiveisSerializados = processosDisponiveis.map(processo => ({
      ...processo,
      valorOriginal: processo.valorOriginal ? Number(processo.valorOriginal) : null,
      valorNegociado: processo.valorNegociado ? Number(processo.valorNegociado) : null
    }))

    return NextResponse.json(processosDisponiveisSerializados)
  } catch (error) {
    console.error('Erro ao buscar processos disponíveis:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}