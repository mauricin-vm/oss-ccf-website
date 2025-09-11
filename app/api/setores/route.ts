import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { PrismaWhereFilter, SessionUser } from '@/types'
import { z } from 'zod'

const setorDtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  sigla: z.string().min(1, 'Sigla é obrigatória'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  responsavel: z.string().optional(),
  ativo: z.boolean().default(true)
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ativo = searchParams.get('ativo')
    
    const where: PrismaWhereFilter = {}
    
    if (ativo !== null) {
      where.ativo = ativo === 'true'
    }

    const setores = await prisma.setor.findMany({
      where,
      orderBy: { nome: 'asc' }
    })

    return NextResponse.json(setores)
  } catch (error) {
    console.error('Erro ao buscar setores:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Criar novo setor
export async function POST(request: NextRequest) {
  try {
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

    // Verificar se já existe setor com mesmo nome ou sigla
    const existingSetor = await prisma.setor.findFirst({
      where: {
        OR: [
          { nome: validatedData.nome },
          { sigla: validatedData.sigla }
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
    const dataToCreate = {
      ...validatedData,
      email: validatedData.email && validatedData.email.trim() !== '' ? validatedData.email : null
    }

    const setor = await prisma.setor.create({
      data: dataToCreate
    })

    return NextResponse.json(setor, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar setor:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}