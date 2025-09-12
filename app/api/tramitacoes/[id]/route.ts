import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser, TramitacaoUpdateData } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const tramitacao = await prisma.tramitacao.findUnique({
      where: { id },
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

    if (!tramitacao) {
      return NextResponse.json(
        { error: 'Tramitação não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(tramitacao)
  } catch (error) {
    console.error('Erro ao buscar tramitação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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

    // Apenas Admin e Funcionário podem editar tramitações
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar tramitações' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Buscar tramitação atual para auditoria
    const tramitacaoAtual = await prisma.tramitacao.findUnique({
      where: { id: id },
      include: { processo: true }
    })

    if (!tramitacaoAtual) {
      return NextResponse.json(
        { error: 'Tramitação não encontrada' },
        { status: 404 }
      )
    }

    // Preparar dados de atualização
    const updateData: TramitacaoUpdateData = {
      ...body,
      updatedAt: new Date()
    }

    const tramitacaoAtualizada = await prisma.tramitacao.update({
      where: { id: id },
      data: updateData,
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
        dadosAnteriores: {
          setorOrigem: tramitacaoAtual.setorOrigem,
          setorDestino: tramitacaoAtual.setorDestino,
          prazoResposta: tramitacaoAtual.prazoResposta,
          observacoes: tramitacaoAtual.observacoes,
          dataRecebimento: tramitacaoAtual.dataRecebimento
        },
        dadosNovos: {
          setorOrigem: tramitacaoAtualizada.setorOrigem,
          setorDestino: tramitacaoAtualizada.setorDestino,
          prazoResposta: tramitacaoAtualizada.prazoResposta,
          observacoes: tramitacaoAtualizada.observacoes,
          dataRecebimento: tramitacaoAtualizada.dataRecebimento
        }
      }
    })

    return NextResponse.json(tramitacaoAtualizada)
  } catch (error) {
    console.error('Erro ao atualizar tramitação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}