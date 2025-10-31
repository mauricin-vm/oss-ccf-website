import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { SessionUser } from '@/types'
const conselheiroDtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  matricula: z.string().optional(),
  origem: z.string().optional(),
  sigla: z.string().optional(),
  ativo: z.boolean().default(true)
})
// GET - Buscar conselheiro por ID
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
    const user = session.user as SessionUser
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const conselheiro = await prisma.conselheiro.findUnique({
      where: { id }
    })
    if (!conselheiro) {
      return NextResponse.json({ error: 'Conselheiro não encontrado' }, { status: 404 })
    }
    return NextResponse.json(conselheiro)
  } catch (error) {
    console.error('Erro ao buscar conselheiro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
// PUT - Atualizar conselheiro
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
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const body = await request.json()
    const validatedData = conselheiroDtoSchema.parse(body)
    // Verificar se o conselheiro existe
    const conselheiro = await prisma.conselheiro.findUnique({
      where: { id }
    })
    if (!conselheiro) {
      return NextResponse.json({ error: 'Conselheiro não encontrado' }, { status: 404 })
    }
    // Processar email vazio
    const dataToUpdate = {
      ...validatedData,
      email: validatedData.email && validatedData.email.trim() !== '' ? validatedData.email : null
    }
    const updatedConselheiro = await prisma.conselheiro.update({
      where: { id },
      data: dataToUpdate
    })
    return NextResponse.json(updatedConselheiro)
  } catch (error) {
    console.error('Erro ao atualizar conselheiro:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
// DELETE - Deletar conselheiro
export async function DELETE(
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
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    // Verificar se o conselheiro existe
    const conselheiro = await prisma.conselheiro.findUnique({
      where: { id }
    })
    if (!conselheiro) {
      return NextResponse.json({ error: 'Conselheiro não encontrado' }, { status: 404 })
    }
    await prisma.conselheiro.delete({
      where: { id }
    })
    return NextResponse.json({ message: 'Conselheiro deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar conselheiro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}