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
    // Verificar se o processo pode ser incluído
    const statusPermitidos = ['EM_ANALISE', 'SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA']
    const statusJulgados = ['JULGADO', 'EM_CUMPRIMENTO', 'CONCLUIDO']
    if (!statusPermitidos.includes(processo.status) && !statusJulgados.includes(processo.status)) {
      return NextResponse.json(
        { error: 'Processo não pode ser incluído em pauta com este status' },
        { status: 400 }
      )
    }
    // Verificar se é repautamento de processo já julgado
    const isRepautamentoJulgado = statusJulgados.includes(processo.status)
    // Buscar distribuição anterior do processo
    const ultimaDistribuicao = await prisma.processoPauta.findFirst({
      where: { processoId },
      include: {
        pauta: true
      },
      orderBy: {
        pauta: {
          dataPauta: 'desc'
        }
      }
    })
    // Obter a próxima ordem na pauta
    const proximaOrdem = pauta.processos.length > 0 
      ? Math.max(...pauta.processos.map(p => p.ordem)) + 1 
      : 1
    // Validar se o relator informado é um conselheiro ativo (se especificado)
    if (relator && relator.trim()) {
      const conselheiroValido = await prisma.conselheiro.findFirst({
        where: { 
          nome: relator.trim(),
          ativo: true 
        }
      })
      if (!conselheiroValido) {
        return NextResponse.json(
          { error: 'Relator deve ser um conselheiro ativo cadastrado no sistema' },
          { status: 400 }
        )
      }
    }
    // Definir distribuição baseada no histórico
    let novoRelator = null
    let distribuidoPara = null
    let novosRevisores: string[] = []
    let observacaoDistribuicao = ''
    if (ultimaDistribuicao) {
      // Se existe histórico, manter o relator original
      novoRelator = ultimaDistribuicao.relator
      novosRevisores = [...(ultimaDistribuicao.revisores || [])]
      // Para PEDIDO_VISTA, incluir novos revisores das decisões de vista
      if (processo.status === 'PEDIDO_VISTA') {
        const decisoesVista = await prisma.decisao.findMany({
          where: { 
            processoId,
            tipoResultado: 'PEDIDO_VISTA'
          },
          orderBy: { createdAt: 'asc' }
        })
        const novosRevisoresVista = decisoesVista
          .map(d => d.conselheiroPedidoVista)
          .filter((conselheiro): conselheiro is string => conselheiro !== null && conselheiro !== undefined && !novosRevisores.includes(conselheiro))
        novosRevisores = [...novosRevisores, ...novosRevisoresVista]
      }
      // Definir distribuição padrão
      const ultimoRevisor = novosRevisores.length > 0 
        ? novosRevisores[novosRevisores.length - 1] 
        : null
      if (relator && relator.trim()) {
        // Distribuição manual especificada
        const conselheiroEscolhido = relator.trim()
        distribuidoPara = conselheiroEscolhido
        // Se escolheu um terceiro conselheiro (não é relator nem revisor existente)
        if (conselheiroEscolhido !== novoRelator && !novosRevisores.includes(conselheiroEscolhido)) {
          novosRevisores = [...novosRevisores, conselheiroEscolhido]
        }
        observacaoDistribuicao = ` - Distribuído para: ${conselheiroEscolhido}`
      } else {
        // Distribuição automática: último revisor se existe, senão relator
        distribuidoPara = ultimoRevisor || novoRelator
        observacaoDistribuicao = ultimoRevisor 
          ? ` - Distribuído para último revisor: ${ultimoRevisor}`
          : ` - Distribuído para relator: ${novoRelator}`
      }
    } else {
      // Primeira distribuição
      novoRelator = relator?.trim() || null
      distribuidoPara = relator?.trim() || null
      observacaoDistribuicao = relator ? ` - Distribuído para: ${relator}` : ''
    }
    await prisma.$transaction(async (tx) => {
      // Incluir processo na pauta
      await tx.processoPauta.create({
        data: {
          pautaId,
          processoId,
          ordem: proximaOrdem,
          relator: novoRelator,
          distribuidoPara: distribuidoPara,
          revisores: novosRevisores
        }
      })
      // Atualizar status do processo
      await tx.processo.update({
        where: { id: processoId },
        data: { status: 'EM_PAUTA' }
      })
      // Criar histórico no processo
      let tituloHistorico = 'Processo incluído em pauta'
      let tipoHistorico = 'PAUTA'
      if (isRepautamentoJulgado) {
        tituloHistorico = 'Processo repautado'
        tipoHistorico = 'REPAUTAMENTO'
      }
      await tx.historicoProcesso.create({
        data: {
          processoId,
          usuarioId: user.id,
          titulo: tituloHistorico,
          descricao: `Processo incluído na ${pauta.numero} agendada para ${new Date(pauta.dataPauta.getTime() + pauta.dataPauta.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR')}${observacaoDistribuicao}${isRepautamentoJulgado ? ' (ATENÇÃO: Processo já foi julgado anteriormente)' : ''}`,
          tipo: tipoHistorico
        }
      })
      // Criar tramitação para o processo (apenas se houver distribuição)
      if (distribuidoPara) {
        await tx.tramitacao.create({
          data: {
            processoId,
            usuarioId: user.id,
            setorOrigem: 'CCF',
            setorDestino: distribuidoPara, // Nome da pessoa (conselheiro)
            observacoes: `Processo distribuído na ${pauta.numero} para julgamento em ${new Date(pauta.dataPauta.getTime() + pauta.dataPauta.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR')}${novosRevisores.length > 0 ? ` - Revisores: ${novosRevisores.join(', ')}` : ''}`
          }
        })
      }
      // Criar histórico na pauta
      const pautaDistribucaoInfo = distribuidoPara ? ` - Distribuído para: ${distribuidoPara}` : ''
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
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
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
      valorOriginal: 0 ? Number(0) : null,
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