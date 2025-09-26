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

    const { id: processoId } = await params

    // Buscar o acórdão do processo
    const acordao = await prisma.acordao.findFirst({
      where: { processoId }
    })

    return NextResponse.json({ acordao })
  } catch (error) {
    console.error('Erro ao buscar acórdão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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
        { error: 'Sem permissão para criar acórdão' },
        { status: 403 }
      )
    }

    const { id: processoId } = await params
    const { numeroAcordao, dataPublicacao, numeroPublicacao } = await request.json()

    // Verificar se o processo existe
    const processo = await prisma.processo.findUnique({
      where: { id: processoId }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já existe um acórdão para este processo
    const acordaoExistente = await prisma.acordao.findFirst({
      where: { processoId }
    })

    if (acordaoExistente) {
      return NextResponse.json(
        { error: 'Já existe um acórdão para este processo' },
        { status: 400 }
      )
    }

    // Criar o acórdão
    const acordao = await prisma.acordao.create({
      data: {
        processoId,
        numeroAcordao,
        dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : null,
        numeroPublicacao
      }
    })

    // Log de auditoria
    const userExists = await prisma.user.findUnique({
      where: { id: user.id }
    })

    if (userExists) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'CREATE',
          entidade: 'Acordao',
          entidadeId: acordao.id,
          dadosNovos: {
            numeroAcordao: acordao.numeroAcordao,
            dataPublicacao: acordao.dataPublicacao,
            numeroPublicacao: acordao.numeroPublicacao,
            processo: processo.numero
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Acórdão criado com sucesso',
      acordao
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar acórdão:', error)
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar acórdão' },
        { status: 403 }
      )
    }

    const { id: processoId } = await params
    const { numeroAcordao, dataPublicacao, numeroPublicacao } = await request.json()

    // Buscar o acórdão existente
    const acordaoExistente = await prisma.acordao.findFirst({
      where: { processoId },
      include: { processo: true }
    })

    if (!acordaoExistente) {
      return NextResponse.json(
        { error: 'Acórdão não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar o acórdão
    const acordao = await prisma.acordao.update({
      where: { id: acordaoExistente.id },
      data: {
        numeroAcordao,
        dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : null,
        numeroPublicacao
      }
    })

    // Log de auditoria
    const userExists = await prisma.user.findUnique({
      where: { id: user.id }
    })

    if (userExists) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'UPDATE',
          entidade: 'Acordao',
          entidadeId: acordao.id,
          dadosAnteriores: {
            numeroAcordao: acordaoExistente.numeroAcordao,
            dataPublicacao: acordaoExistente.dataPublicacao,
            numeroPublicacao: acordaoExistente.numeroPublicacao
          },
          dadosNovos: {
            numeroAcordao: acordao.numeroAcordao,
            dataPublicacao: acordao.dataPublicacao,
            numeroPublicacao: acordao.numeroPublicacao,
            processo: acordaoExistente.processo.numero
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Acórdão atualizado com sucesso',
      acordao
    })

  } catch (error) {
    console.error('Erro ao atualizar acórdão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Apenas administradores podem excluir acórdãos' },
        { status: 403 }
      )
    }

    const { id: processoId } = await params

    // Buscar o acórdão existente
    const acordaoExistente = await prisma.acordao.findFirst({
      where: { processoId },
      include: { processo: true }
    })

    if (!acordaoExistente) {
      return NextResponse.json(
        { error: 'Acórdão não encontrado' },
        { status: 404 }
      )
    }

    // Excluir o acórdão
    await prisma.acordao.delete({
      where: { id: acordaoExistente.id }
    })

    // Log de auditoria
    const userExists = await prisma.user.findUnique({
      where: { id: user.id }
    })

    if (userExists) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'DELETE',
          entidade: 'Acordao',
          entidadeId: acordaoExistente.id,
          dadosAnteriores: {
            numeroAcordao: acordaoExistente.numeroAcordao,
            dataPublicacao: acordaoExistente.dataPublicacao,
            numeroPublicacao: acordaoExistente.numeroPublicacao,
            processo: acordaoExistente.processo.numero
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Acórdão excluído com sucesso'
    })

  } catch (error) {
    console.error('Erro ao excluir acórdão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}