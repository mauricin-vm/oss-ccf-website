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

    const { id: pautaId } = await params

    // Buscar processos na pauta que já foram julgados anteriormente
    const processosComNotificacao = await prisma.processoPauta.findMany({
      where: {
        pautaId,
        processo: {
          status: {
            in: ['JULGADO', 'ACORDO_FIRMADO', 'EM_CUMPRIMENTO', 'ARQUIVADO']
          }
        }
      },
      include: {
        processo: {
          include: {
            contribuinte: true,
            decisoes: {
              where: {
                tipoResultado: 'JULGADO'
              },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    })

    const notificacoes = processosComNotificacao.map(pp => ({
      processoId: pp.processo.id,
      numero: pp.processo.numero,
      contribuinte: pp.processo.contribuinte.nome,
      status: pp.processo.status,
      ultimaDecisao: pp.processo.decisoes[0] ? {
        data: pp.processo.decisoes[0].dataDecisao,
        tipoDecisao: pp.processo.decisoes[0].tipoDecisao
      } : null,
      relator: pp.relator,
      revisores: pp.revisores || [],
      ordem: pp.ordem
    }))

    return NextResponse.json({ notificacoes })
  } catch (error) {
    console.error('Erro ao buscar notificações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}