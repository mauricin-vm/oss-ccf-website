import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { id: processoId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Status atual do processo
    // Buscar processo com status atual
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      select: { status: true, numero: true }
    })
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }
    // Buscar última distribuição do processo
    const ultimaDistribuicao = await prisma.processoPauta.findFirst({
      where: { processoId },
      orderBy: { id: 'desc' },
      include: {
        pauta: {
          select: {
            numero: true,
            dataPauta: true
          }
        }
      }
    })
    if (!ultimaDistribuicao) {
      return NextResponse.json({
        relator: null,
        revisores: [],
        ultimaPauta: null,
        sugestao: null,
        opcoes: [],
        permitirAlteracao: true
      })
    }
    // Determinar sugestão baseada no status
    let sugestao = null
    const statusAtual = status || processo.status
    switch (statusAtual) {
      case 'SUSPENSO':
      case 'PEDIDO_DILIGENCIA':
        // Último membro na distribuição (último revisor ou relator se não há revisores)
        const ultimoMembro = ultimaDistribuicao.revisores && ultimaDistribuicao.revisores.length > 0
          ? ultimaDistribuicao.revisores[ultimaDistribuicao.revisores.length - 1]
          : ultimaDistribuicao.relator
        sugestao = ultimoMembro
        break
      case 'PEDIDO_VISTA':
        // Buscar quem pediu vista mais recentemente
        const ultimaVista = await prisma.decisao.findFirst({
          where: { 
            processoId,
            tipoResultado: 'PEDIDO_VISTA'
          },
          orderBy: { createdAt: 'desc' }
        })
        // Por padrão, sugere o último revisor (quem pediu vista)
        if (ultimaVista && ultimaVista.conselheiroPedidoVista) {
          sugestao = ultimaVista.conselheiroPedidoVista
        } else if (ultimaDistribuicao.revisores && ultimaDistribuicao.revisores.length > 0) {
          sugestao = ultimaDistribuicao.revisores[ultimaDistribuicao.revisores.length - 1]
        } else {
          sugestao = ultimaDistribuicao.relator
        }
        break
      default:
        sugestao = ultimaDistribuicao.relator
    }
    // Buscar conselheiros ativos para opções de redistribuição
    const conselheirosAtivos = await prisma.conselheiro.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        cargo: true,
        origem: true
      }
    })
    // Criar lista de opções para redistribuição
    const opcoes: Array<{
      nome: string;
      tipo: string;
      descricao: string;
      origem?: string;
      isSugestao: boolean;
    }> = []
    // Relator original
    if (ultimaDistribuicao.relator) {
      opcoes.push({
        nome: ultimaDistribuicao.relator,
        tipo: 'RELATOR_ORIGINAL',
        descricao: 'Relator original',
        isSugestao: sugestao === ultimaDistribuicao.relator
      })
    }
    // Revisores
    ultimaDistribuicao.revisores?.forEach((revisor, index) => {
      opcoes.push({
        nome: revisor,
        tipo: 'REVISOR',
        descricao: `Revisor ${index + 1}`,
        isSugestao: sugestao === revisor
      })
    })
    // Todos os conselheiros ativos como opção
    conselheirosAtivos.forEach(conselheiro => {
      // Não duplicar se já está na lista como relator ou revisor
      const jaExiste = opcoes.some(opcao => opcao.nome === conselheiro.nome)
      if (!jaExiste) {
        opcoes.push({
          nome: conselheiro.nome,
          tipo: 'CONSELHEIRO_ATIVO',
          descricao: conselheiro.cargo ? `${conselheiro.cargo}` : 'Conselheiro',
          origem: conselheiro.origem || undefined,
          isSugestao: false
        })
      }
    })
    return NextResponse.json({
      relator: ultimaDistribuicao.relator,
      revisores: ultimaDistribuicao.revisores || [],
      ultimaPauta: {
        numero: ultimaDistribuicao.pauta.numero,
        data: ultimaDistribuicao.pauta.dataPauta
      },
      sugestao, // Quem deve ser sugerido como padrão
      opcoes,
      conselheirosAtivos, // Lista completa de conselheiros ativos
      permitirAlteracao: true, // Sempre permite alteração manual
      statusAtual,
      motivoSugestao: getMotiveSuggestion(statusAtual)
    })
    function getMotiveSuggestion(status: string): string {
      switch (status) {
        case 'SUSPENSO':
          return 'Sugerido último membro que trabalhou no processo'
        case 'PEDIDO_DILIGENCIA':
          return 'Sugerido último membro para cumprimento da diligência'
        case 'PEDIDO_VISTA':
          return 'Sugerido último revisor (quem pediu vista). Relator original será mantido.'
        default:
          return 'Sugerido relator anterior'
      }
    }
  } catch (error) {
    console.error('Erro ao buscar distribuição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}