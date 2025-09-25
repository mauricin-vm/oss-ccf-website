import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const resolvedParams = await params

    // Buscar acordo com seus dados específicos
    const acordo = await prisma.acordo.findUnique({
      where: { id: resolvedParams.id },
      include: {
        transacao: true,
        compensacao: true,
        dacao: true,
        creditos: true,
        inscricoes: {
          include: {
            debitos: true
          }
        },
        processo: true
      }
    })

    if (!acordo) {
      return NextResponse.json({ error: 'Acordo não encontrado' }, { status: 404 })
    }

    // Construir detalhes baseado no tipo de processo
    const detalhes: any[] = []

    if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      // Para transação excepcional, criar um detalhe com as inscrições
      const detalhe = {
        id: `transacao-${acordo.id}`,
        tipo: 'transacao',
        descricao: 'Transação Excepcional',
        valorOriginal: acordo.inscricoes.reduce((total, inscricao) => {
          return total + inscricao.debitos.reduce((subtotal, debito) => {
            return subtotal + Number(debito.valorLancado)
          }, 0)
        }, 0),
        inscricoes: acordo.inscricoes.map(inscricao => ({
          ...inscricao,
          valorDebito: inscricao.debitos.reduce((total, debito) => total + Number(debito.valorLancado), 0),
          descricaoDebitos: inscricao.debitos
        })),
        createdAt: acordo.createdAt
      }
      detalhes.push(detalhe)
    }

    if (acordo.tipoProcesso === 'COMPENSACAO') {
      // Para compensação, criar detalhes baseados nos créditos e inscrições
      const detalhe = {
        id: `compensacao-${acordo.id}`,
        tipo: 'compensacao',
        descricao: 'Compensação de Créditos e Débitos',
        valorOriginal: acordo.creditos.reduce((total, credito) => total + Number(credito.valor), 0),
        inscricoes: acordo.inscricoes.map(inscricao => ({
          ...inscricao,
          valorDebito: inscricao.debitos.reduce((total, debito) => total + Number(debito.valorLancado), 0),
          descricaoDebitos: inscricao.debitos
        })),
        observacoes: JSON.stringify({
          creditosOferecidos: acordo.creditos,
          valorTotalCreditos: acordo.creditos.reduce((total, credito) => total + Number(credito.valor), 0)
        }),
        createdAt: acordo.createdAt
      }
      detalhes.push(detalhe)
    }

    if (acordo.tipoProcesso === 'DACAO_PAGAMENTO') {
      // Para dação, criar detalhes baseados nos créditos (inscrições oferecidas) e inscrições a compensar
      const inscricoesOferecidas = acordo.creditos.filter(c => c.tipoCredito === 'DACAO_IMOVEL')

      const detalhe = {
        id: `dacao-${acordo.id}`,
        tipo: 'dacao',
        descricao: 'Dação em Pagamento',
        valorOriginal: inscricoesOferecidas.reduce((total, inscricao) => total + Number(inscricao.valor), 0),
        inscricoes: acordo.inscricoes.map(inscricao => ({
          ...inscricao,
          valorDebito: inscricao.debitos.reduce((total, debito) => total + Number(debito.valorLancado), 0),
          descricaoDebitos: inscricao.debitos
        })),
        observacoes: JSON.stringify({
          inscricoesOferecidas: inscricoesOferecidas.map(inscricao => ({
            numeroInscricao: inscricao.numeroCredito,
            tipoInscricao: 'imobiliaria', // Assumindo que dação é sempre imobiliária
            valor: Number(inscricao.valor),
            descricao: inscricao.descricao,
            dataVencimento: inscricao.dataVencimento
          })),
          valorTotalOferecido: inscricoesOferecidas.reduce((total, inscricao) => total + Number(inscricao.valor), 0)
        }),
        createdAt: acordo.createdAt
      }
      detalhes.push(detalhe)
    }

    return NextResponse.json({ detalhes })
  } catch (error) {
    console.error('Erro ao buscar detalhes do acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    // Apenas Admin e Funcionário podem atualizar detalhes
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar detalhes do acordo' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const { detalheId, status, observacoes } = body
    if (!detalheId || !status) {
      return NextResponse.json(
        { error: 'Detalhe ID e status são obrigatórios' },
        { status: 400 }
      )
    }
    const resolvedParams = await params
    // Verificar se o detalhe pertence ao acordo
    const detalhe = await prisma.acordoDetalhes.findFirst({
      where: {
        id: detalheId,
        acordoId: resolvedParams.id
      },
      include: {
        acordo: {
          include: {
            processo: true
          }
        }
      }
    })
    if (!detalhe) {
      return NextResponse.json(
        { error: 'Detalhe não encontrado' },
        { status: 404 }
      )
    }
    // Atualizar o detalhe
    const dataExecucao = status === 'EXECUTADO' && detalhe.status !== 'EXECUTADO'
      ? new Date()
      : detalhe.dataExecucao
    const detalheAtualizado = await prisma.acordoDetalhes.update({
      where: { id: detalheId },
      data: {
        status: status,
        observacoes,
        dataExecucao
      },
      include: {
        inscricoes: true,
        imovel: true,
        credito: true
      }
    })
    // Se foi marcado como executado, atualizar situação das inscrições relacionadas
    if (status === 'EXECUTADO' && detalhe.status !== 'EXECUTADO') {
      await prisma.acordoInscricao.updateMany({
        where: { acordoDetalheId: detalheId },
        data: { situacao: 'quitado' }
      })
    }
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'AcordoDetalhes',
        entidadeId: detalheId,
        dadosAnteriores: {
          status: detalhe.status,
          observacoes: detalhe.observacoes
        },
        dadosNovos: {
          status,
          observacoes,
          dataExecucao
        }
      }
    })
    // Verificar se todos os detalhes foram concluídos para atualizar status do acordo
    const todosDetalhes = await prisma.acordoDetalhes.findMany({
      where: { acordoId: resolvedParams.id }
    })
    const todosConcluidos = todosDetalhes.every(d => d.status === 'EXECUTADO')
    if (todosConcluidos && todosDetalhes.length > 0) {
      await prisma.acordo.update({
        where: { id: resolvedParams.id },
        data: { status: 'cumprido' }
      })
      // Atualizar status do processo
      await prisma.processo.update({
        where: { id: detalhe.acordo.processoId },
        data: { status: 'EM_CUMPRIMENTO' }
      })
    }
    return NextResponse.json({ detalhe: detalheAtualizado })
  } catch (error) {
    console.error('Erro ao atualizar detalhe do acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}