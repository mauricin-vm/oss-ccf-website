import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processoId: string }> }
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

    const { id: pautaId, processoId } = await params

    // Verificar se a pauta existe e está aberta
    const pauta = await prisma.pauta.findUnique({
      where: { id: pautaId },
      include: {
        processos: {
          where: { processoId }
        }
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

    // Verificar se o processo está na pauta
    const processoPauta = pauta.processos[0]
    if (!processoPauta) {
      return NextResponse.json(
        { error: 'Processo não está incluído nesta pauta' },
        { status: 400 }
      )
    }

    // Buscar dados do processo para o histórico
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        contribuinte: true
      }
    })

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Remover processo da pauta
      await tx.processoPauta.delete({
        where: {
          processoId_pautaId: {
            processoId,
            pautaId
          }
        }
      })

      // Reordenar os processos restantes na pauta
      const processosRestantes = await tx.processoPauta.findMany({
        where: { pautaId },
        orderBy: { ordem: 'asc' }
      })

      for (let i = 0; i < processosRestantes.length; i++) {
        await tx.processoPauta.update({
          where: {
            processoId_pautaId: {
              processoId: processosRestantes[i].processoId,
              pautaId
            }
          },
          data: { ordem: i + 1 }
        })
      }

      // Atualizar status do processo de volta para EM_ANALISE
      await tx.processo.update({
        where: { id: processoId },
        data: { status: 'EM_ANALISE' }
      })

      // Criar histórico no processo
      await tx.historicoProcesso.create({
        data: {
          processoId,
          usuarioId: user.id,
          titulo: 'Processo removido de pauta',
          descricao: `Processo removido da ${pauta.numero} agendada para ${pauta.dataPauta.toLocaleDateString('pt-BR')}`,
          tipo: 'PAUTA'
        }
      })

      // Não criar tramitação automática na remoção
      // O retorno deve ser feito manualmente pelo usuário quando necessário

      // Criar histórico na pauta
      await tx.historicoPauta.create({
        data: {
          pautaId,
          usuarioId: user.id,
          titulo: 'Processo removido',
          descricao: `Processo ${processo.numero} removido da pauta`,
          tipo: 'PROCESSO_REMOVIDO'
        }
      })
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'ProcessoPauta',
        entidadeId: `${pautaId}-${processoId}`,
        dadosAnteriores: {
          pautaId,
          processoId,
          ordem: processoPauta.ordem,
          pautaNumero: pauta.numero,
          processoNumero: processo.numero,
          contribuinte: processo.contribuinte.nome
        }
      }
    })

    return NextResponse.json({ 
      message: 'Processo removido da pauta com sucesso'
    })
  } catch (error) {
    console.error('Erro ao remover processo da pauta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}