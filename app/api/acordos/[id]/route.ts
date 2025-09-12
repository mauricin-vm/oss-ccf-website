import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser, AcordoUpdateData } from '@/types'

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

    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: {
          include: {
            contribuinte: true,
            tramitacoes: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              include: {
                usuario: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            },
            decisoes: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        parcelas: {
          orderBy: { numero: 'asc' },
          include: {
            pagamentos: {
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    })

    if (!acordo) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(acordo)
  } catch (error) {
    console.error('Erro ao buscar acordo:', error)
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
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin e Funcionário podem editar acordos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar acordos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Buscar acordo atual
    const acordoAtual = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: true,
        parcelas: {
          include: {
            pagamentos: true
          }
        }
      }
    })

    if (!acordoAtual) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o acordo pode ser editado
    if (acordoAtual.status === 'cancelado' || acordoAtual.status === 'cumprido') {
      return NextResponse.json(
        { error: 'Acordos cancelados ou cumpridos não podem ser editados' },
        { status: 400 }
      )
    }

    // Se há pagamentos, limitar edições
    if (acordoAtual.pagamentos.length > 0) {
      return NextResponse.json(
        { error: 'Acordos com pagamentos registrados não podem ser editados. Use a renegociação.' },
        { status: 400 }
      )
    }

    // Preparar dados de atualização
    const updateData: AcordoUpdateData = {
      updatedAt: new Date()
    }

    // Campos que podem ser atualizados
    if (body.dataVencimento) {
      updateData.dataVencimento = new Date(body.dataVencimento)
    }
    if (body.observacoes !== undefined) {
      updateData.observacoes = body.observacoes
    }
    if (body.clausulasEspeciais !== undefined) {
      updateData.clausulasEspeciais = body.clausulasEspeciais
    }
    if (body.status && ['ativo', 'vencido', 'cancelado'].includes(body.status)) {
      updateData.status = body.status
    }

    const acordoAtualizado = await prisma.acordo.update({
      where: { id },
      data: updateData,
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        parcelas: {
          orderBy: { numero: 'asc' }
        },
        pagamentos: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // Se cancelando o acordo, atualizar status do processo
    if (body.status === 'cancelado') {
      await prisma.processo.update({
        where: { id: acordoAtual.processoId },
        data: { status: 'DEFERIDO' } // Volta para o status anterior
      })

      // Cancelar parcelas pendentes
      await prisma.parcela.updateMany({
        where: { 
          acordoId: id,
          status: 'PENDENTE'
        },
        data: { status: 'CANCELADO' }
      })
    }

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Acordo',
        entidadeId: id,
        dadosAnteriores: {
          status: acordoAtual.status,
          dataVencimento: acordoAtual.dataVencimento,
          observacoes: acordoAtual.observacoes
        },
        dadosNovos: {
          status: acordoAtualizado.status,
          dataVencimento: acordoAtualizado.dataVencimento,
          observacoes: acordoAtualizado.observacoes
        }
      }
    })

    return NextResponse.json(acordoAtualizado)
  } catch (error) {
    console.error('Erro ao atualizar acordo:', error)
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
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin pode deletar acordos
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar acordos' },
        { status: 403 }
      )
    }

    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: { 
        processo: true,
        parcelas: {
          include: {
            pagamentos: true
          }
        }
      }
    })

    if (!acordo) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se pode ser deletado (apenas acordos sem pagamentos)
    if (acordo.pagamentos.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar acordos que já têm pagamentos registrados' },
        { status: 400 }
      )
    }

    // Deletar em cascata: parcelas primeiro, depois acordo
    await prisma.parcela.deleteMany({
      where: { acordoId: id }
    })

    await prisma.acordo.delete({
      where: { id }
    })

    // Retornar processo ao status anterior
    await prisma.processo.update({
      where: { id: acordo.processoId },
      data: { status: 'DEFERIDO' }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Acordo',
        entidadeId: id,
        dadosAnteriores: {
          processoNumero: acordo.processo.numero,
          valorTotal: acordo.valorTotal,
          valorFinal: acordo.valorFinal,
          modalidadePagamento: acordo.modalidadePagamento,
          status: acordo.status
        }
      }
    })

    return NextResponse.json({ message: 'Acordo deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}