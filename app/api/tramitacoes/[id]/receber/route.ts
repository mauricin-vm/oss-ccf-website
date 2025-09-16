import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    // Apenas Admin e Funcionário podem marcar como recebida
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para marcar tramitações como recebidas' },
        { status: 403 }
      )
    }
    // Buscar tramitação
    const tramitacao = await prisma.tramitacao.findUnique({
      where: { id },
      include: { 
        processo: {
          include: {
            contribuinte: true
          }
        }
      }
    })
    if (!tramitacao) {
      return NextResponse.json(
        { error: 'Tramitação não encontrada' },
        { status: 404 }
      )
    }
    // Verificar se já foi recebida
    if (tramitacao.dataRecebimento) {
      return NextResponse.json(
        { error: 'Tramitação já foi marcada como recebida' },
        { status: 400 }
      )
    }
    // Marcar como recebida
    const tramitacaoAtualizada = await prisma.tramitacao.update({
      where: { id },
      data: {
        dataRecebimento: new Date(),
        updatedAt: new Date()
      },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        usuario: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Tramitacao',
        entidadeId: id,
        dadosNovos: {
          acao: 'MARCADA_COMO_RECEBIDA',
          dataRecebimento: new Date(),
          processoNumero: tramitacao.processo.numero,
          setorOrigem: tramitacao.setorOrigem,
          setorDestino: tramitacao.setorDestino
        }
      }
    })
    // Criar histórico do processo indicando que retornou à CCF
    await prisma.historicoProcesso.create({
      data: {
        processoId: tramitacao.processoId,
        usuarioId: user.id,
        titulo: 'Processo retornou à CCF',
        descricao: `Tramitação do ${tramitacao.setorOrigem} para ${tramitacao.setorDestino} foi marcada como entregue. O processo retornou à CCF.`,
        tipo: 'TRAMITACAO_ENTREGUE'
      }
    })
    return NextResponse.json({
      message: 'Tramitação marcada como recebida com sucesso',
      tramitacao: tramitacaoAtualizada
    })
  } catch (error) {
    console.error('Erro ao marcar tramitação como recebida:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}