import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

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
        { error: 'Sem permissão para modificar pautas' },
        { status: 403 }
      )
    }

    const { id: pautaId } = await params
    const { processosOrdem } = await request.json()

    if (!Array.isArray(processosOrdem)) {
      return NextResponse.json(
        { error: 'processosOrdem deve ser um array' },
        { status: 400 }
      )
    }

    // Verificar se a pauta existe e está aberta
    const pauta = await prisma.pauta.findUnique({
      where: { id: pautaId }
    })

    if (!pauta) {
      return NextResponse.json({ error: 'Pauta não encontrada' }, { status: 404 })
    }

    if (pauta.status === 'fechada') {
      return NextResponse.json(
        { error: 'Não é possível reordenar processos de pautas com sessão finalizada' },
        { status: 400 }
      )
    }

    // Atualizar ordem dos processos
    await prisma.$transaction(async (tx) => {
      for (const item of processosOrdem) {
        await tx.processoPauta.updateMany({
          where: {
            pautaId,
            processoId: item.processoId
          },
          data: {
            ordem: item.ordem
          }
        })
      }

      // Criar histórico na pauta
      await tx.historicoPauta.create({
        data: {
          pautaId,
          usuarioId: user.id,
          titulo: 'Ordem de processos alterada',
          descricao: 'A ordem de julgamento dos processos foi reorganizada',
          tipo: 'ALTERACAO'
        }
      })
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'ProcessoPauta',
        entidadeId: pautaId,
        dadosNovos: {
          pautaNumero: pauta.numero,
          acao: 'Reordenação de processos',
          novaOrdem: processosOrdem
        }
      }
    })

    return NextResponse.json({
      message: 'Ordem dos processos atualizada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao atualizar ordem dos processos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
