import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

// PUT - Atualiza status da folha de jeton
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const canAccess = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'

    if (!canAccess) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { status, dataEntrega, observacoes } = body

    // Verificar se folha existe
    const folhaExistente = await prisma.folhaJeton.findUnique({
      where: { id }
    })

    if (!folhaExistente) {
      return NextResponse.json({ error: 'Folha não encontrada' }, { status: 404 })
    }

    // Validações
    if (status && !['PENDENTE', 'ENTREGUE'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Atualizar folha
    const folha = await prisma.folhaJeton.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(dataEntrega !== undefined && {
          dataEntrega: dataEntrega ? new Date(dataEntrega) : null
        }),
        ...(observacoes !== undefined && { observacoes })
      },
      include: {
        sessao: {
          include: {
            pauta: true
          }
        },
        membros: {
          include: {
            conselheiro: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Status atualizado com sucesso',
      folha
    })
  } catch (error) {
    console.error('Erro ao atualizar folha:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar folha' },
      { status: 500 }
    )
  }
}

// DELETE - Remove folha de jeton
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const canAccess = user.role === 'ADMIN'

    if (!canAccess) {
      return NextResponse.json({ error: 'Apenas administradores podem deletar folhas' }, { status: 403 })
    }

    const { id } = await params

    // Verificar se folha existe
    const folhaExistente = await prisma.folhaJeton.findUnique({
      where: { id }
    })

    if (!folhaExistente) {
      return NextResponse.json({ error: 'Folha não encontrada' }, { status: 404 })
    }

    // Deletar folha (membros serão deletados em cascata)
    await prisma.folhaJeton.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Folha removida com sucesso'
    })
  } catch (error) {
    console.error('Erro ao deletar folha:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar folha' },
      { status: 500 }
    )
  }
}
