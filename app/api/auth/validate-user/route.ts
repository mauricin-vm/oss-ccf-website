import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Usuário não encontrado ou inativo' }, { status: 404 })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Erro ao validar usuário:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}