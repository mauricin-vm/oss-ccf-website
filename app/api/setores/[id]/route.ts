import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { z } from 'zod'

const setorDtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  sigla: z.string().min(1, 'Sigla é obrigatória'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  responsavel: z.string().optional(),
  ativo: z.boolean().default(true)
})

// GET - Buscar setor por ID
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

    const setor = await prisma.setor.findUnique({
      where: { id }
    })

    if (!setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }

    return NextResponse.json(setor)
  } catch (error) {
    console.error('Erro ao buscar setor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT - Atualizar setor
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
    const validatedData = setorDtoSchema.parse(body)

    // Verificar se o setor existe
    const setor = await prisma.setor.findUnique({
      where: { id: id }
    })

    if (!setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }

    // Verificar se já existe outro setor com mesmo nome ou sigla
    const existingSetor = await prisma.setor.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              { nome: validatedData.nome },
              { sigla: validatedData.sigla }
            ]
          }
        ]
      }
    })

    if (existingSetor) {
      if (existingSetor.nome === validatedData.nome) {
        return NextResponse.json({ error: 'Já existe um setor com este nome' }, { status: 400 })
      }
      if (existingSetor.sigla === validatedData.sigla) {
        return NextResponse.json({ error: 'Já existe um setor com esta sigla' }, { status: 400 })
      }
    }

    // Processar email vazio
    const dataToUpdate = {
      ...validatedData,
      email: validatedData.email && validatedData.email.trim() !== '' ? validatedData.email : null
    }

    const updatedSetor = await prisma.setor.update({
      where: { id: id },
      data: dataToUpdate
    })

    return NextResponse.json(updatedSetor)
  } catch (error) {
    console.error('Erro ao atualizar setor:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE - Deletar setor
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

    // Verificar se o setor existe
    const setor = await prisma.setor.findUnique({
      where: { id: id }
    })

    if (!setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }

    await prisma.setor.delete({
      where: { id: id }
    })

    return NextResponse.json({ message: 'Setor deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar setor:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}