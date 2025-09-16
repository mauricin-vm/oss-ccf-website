import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { SessionUser, UserUpdateData } from '@/types'
const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  role: z.enum(['ADMIN', 'FUNCIONARIO', 'VISUALIZADOR']).optional(),
  active: z.boolean().optional()
})
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    const { id } = await params
    // Apenas Admin pode visualizar detalhes de usuários
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para visualizar usuário' },
        { status: 403 }
      )
    }
    const userDetails = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            processosCreated: true,
            tramitacoes: true,
            sessoes: true,
            logs: true
          }
        }
      }
    })
    if (!userDetails) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }
    return NextResponse.json(userDetails)
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
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
    const { id } = await params
    // Apenas Admin pode editar usuários
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para editar usuários' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const validationResult = updateUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }
    const updateData = validationResult.data
    // Buscar usuário atual
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true
      }
    })
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se email já existe (apenas se estiver sendo alterado)
    if (updateData.email && updateData.email !== currentUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: updateData.email }
      })
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email já está em uso' },
          { status: 400 }
        )
      }
    }
    // Hash da senha se fornecida
    const dataToUpdate: UserUpdateData = { ...updateData }
    if (updateData.password) {
      dataToUpdate.password = await hash(updateData.password, 12)
    }
    // Atualizar usuário
    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'User',
        entidadeId: id,
        dadosAnteriores: {
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          active: currentUser.active
        },
        dadosNovos: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          active: updatedUser.active
        }
      }
    })
    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
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
    const { id } = await params
    // Apenas Admin pode deletar usuários
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar usuários' },
        { status: 403 }
      )
    }
    // Não permitir deletar o próprio usuário
    if (user.id === id) {
      return NextResponse.json(
        { error: 'Não é possível deletar seu próprio usuário' },
        { status: 400 }
      )
    }
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            processosCreated: true,
            tramitacoes: true,
            sessoes: true
          }
        }
      }
    })
    if (!userToDelete) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se usuário tem atividades importantes
    const hasActivity = userToDelete._count.processosCreated > 0 || 
                       userToDelete._count.tramitacoes > 0 || 
                       userToDelete._count.sessoes > 0
    if (hasActivity) {
      // Em vez de deletar, apenas desativar
      const deactivatedUser = await prisma.user.update({
        where: { id },
        data: { active: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true
        }
      })
      // Log de auditoria
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'DEACTIVATE',
          entidade: 'User',
          entidadeId: id,
          dadosAnteriores: {
            active: true
          },
          dadosNovos: {
            active: false
          }
        }
      })
      return NextResponse.json({
        message: 'Usuário desativado devido a atividades registradas',
        user: deactivatedUser
      })
    } else {
      // Deletar usuário se não tem atividades
      await prisma.user.delete({
        where: { id }
      })
      // Log de auditoria
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'DELETE',
          entidade: 'User',
          entidadeId: id,
          dadosAnteriores: {
            name: userToDelete.name,
            email: userToDelete.email,
            role: userToDelete.role
          }
        }
      })
      return NextResponse.json({
        message: 'Usuário deletado com sucesso'
      })
    }
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}