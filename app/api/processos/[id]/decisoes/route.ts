import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

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

    // Buscar decisões do processo
    const decisoes = await prisma.decisao.findMany({
      where: {
        processoId,
        tipoResultado: 'JULGADO'
      },
      select: {
        id: true,
        tipoDecisao: true,
        tipoResultado: true,
        observacoes: true,
        createdAt: true,
        sessao: {
          select: {
            id: true,
            dataInicio: true,
            pauta: {
              select: {
                numero: true,
                dataPauta: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ decisoes })
  } catch (error) {
    console.error('Erro ao buscar decisões do processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}