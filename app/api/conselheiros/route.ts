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
  origem: z.string().optional(),
  ativo: z.boolean().default(true)
})
// GET - Listar conselheiros
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const incluirInativos = searchParams.get('incluirInativos') === 'true'
    const apenasAtivos = searchParams.get('apenasAtivos') === 'true'
    // Permitir que todos os usuários autenticados vejam os conselheiros
    // pois são necessários para designar relatores em pautas
    const where = incluirInativos 
      ? {} 
      : apenasAtivos 
        ? { ativo: true }
        : {} // Por padrão, mostra todos para compatibilidade
    const conselheiros = await prisma.conselheiro.findMany({
      where,
      orderBy: {
        nome: 'asc'
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        cargo: true,
        origem: true,
        ativo: true
      }
    })
    return NextResponse.json({ conselheiros })
  } catch (error) {
    console.error('Erro ao buscar conselheiros:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
// POST - Criar novo conselheiro
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
    const validatedData = conselheiroDtoSchema.parse(body)
    // Processar email vazio
    const dataToCreate = {
      ...validatedData,
      email: validatedData.email && validatedData.email.trim() !== '' ? validatedData.email : null
    }
    const conselheiro = await prisma.conselheiro.create({
      data: dataToCreate
    })
    return NextResponse.json(conselheiro, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar conselheiro:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}