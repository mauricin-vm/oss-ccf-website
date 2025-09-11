import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { PrismaWhereFilter } from '@/types'

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