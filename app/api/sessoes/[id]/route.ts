import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser, SessaoUpdateData } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sessao = await prisma.sessaoJulgamento.findUnique({
      where: { id: params.id },
      include: {
        pauta: {
          include: {
            processos: {
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
                    }
                  }
                }
              },
              orderBy: { ordem: 'asc' }
            }
          }
        },
        decisoes: {
          include: {
            processo: {
              include: {
                contribuinte: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        conselheiros: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!sessao) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(sessao)
  } catch (error) {
    console.error('Erro ao buscar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin e Funcionário podem editar sessões
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar sessões' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Buscar sessão atual
    const sessaoAtual = await prisma.sessaoJulgamento.findUnique({
      where: { id: params.id },
      include: {
        pauta: true,
        conselheiros: true
      }
    })

    if (!sessaoAtual) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a sessão pode ser editada (apenas sessões não finalizadas)
    if (sessaoAtual.dataFim) {
      return NextResponse.json(
        { error: 'Sessões finalizadas não podem ser editadas' },
        { status: 400 }
      )
    }

    // Preparar dados de atualização
    const updateData: SessaoUpdateData = {
      updatedAt: new Date()
    }

    if (body.ata !== undefined) {
      updateData.ata = body.ata
    }

    if (body.dataFim) {
      updateData.dataFim = new Date(body.dataFim)
      
      // Se está finalizando a sessão, atualizar status da pauta
      await prisma.pauta.update({
        where: { id: sessaoAtual.pautaId },
        data: { status: 'finalizada' }
      })
    }

    if (body.conselheiros && Array.isArray(body.conselheiros)) {
      // Verificar se todos os conselheiros são elegíveis
      const conselheiros = await prisma.user.findMany({
        where: { 
          id: { in: body.conselheiros },
          role: { in: ['ADMIN', 'FUNCIONARIO'] }
        }
      })

      if (conselheiros.length !== body.conselheiros.length) {
        return NextResponse.json(
          { error: 'Um ou mais conselheiros não são elegíveis' },
          { status: 400 }
        )
      }

      updateData.conselheiros = {
        set: body.conselheiros.map((id: string) => ({ id }))
      }
    }

    const sessaoAtualizada = await prisma.sessaoJulgamento.update({
      where: { id: params.id },
      data: updateData,
      include: {
        pauta: {
          include: {
            processos: {
              include: {
                processo: {
                  include: {
                    contribuinte: true
                  }
                }
              },
              orderBy: { ordem: 'asc' }
            }
          }
        },
        decisoes: {
          include: {
            processo: {
              include: {
                contribuinte: true
              }
            }
          }
        },
        conselheiros: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'SessaoJulgamento',
        entidadeId: params.id,
        dadosAnteriores: {
          ata: sessaoAtual.ata,
          dataFim: sessaoAtual.dataFim,
          conselheiros: sessaoAtual.conselheiros.map(c => c.id)
        },
        dadosNovos: {
          ata: sessaoAtualizada.ata,
          dataFim: sessaoAtualizada.dataFim,
          conselheiros: sessaoAtualizada.conselheiros.map(c => c.id)
        }
      }
    })

    return NextResponse.json(sessaoAtualizada)
  } catch (error) {
    console.error('Erro ao atualizar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin pode deletar sessões
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar sessões' },
        { status: 403 }
      )
    }

    const sessao = await prisma.sessaoJulgamento.findUnique({
      where: { id: params.id },
      include: { 
        pauta: true,
        decisoes: true
      }
    })

    if (!sessao) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se pode ser deletada (apenas sessões sem decisões e não finalizadas)
    if (sessao.decisoes.length > 0 || sessao.dataFim) {
      return NextResponse.json(
        { error: 'Não é possível deletar sessões que já têm decisões ou estão finalizadas' },
        { status: 400 }
      )
    }

    // Retornar pauta ao status aberta
    await prisma.pauta.update({
      where: { id: sessao.pautaId },
      data: { status: 'aberta' }
    })

    await prisma.sessaoJulgamento.delete({
      where: { id: params.id }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'SessaoJulgamento',
        entidadeId: params.id,
        dadosAnteriores: {
          pautaNumero: sessao.pauta.numero,
          dataInicio: sessao.dataInicio,
          dataFim: sessao.dataFim
        }
      }
    })

    return NextResponse.json({ message: 'Sessão deletada com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}