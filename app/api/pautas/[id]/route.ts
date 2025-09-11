import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser, PautaUpdateData } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const pauta = await prisma.pauta.findUnique({
      where: { id: params.id },
      include: {
        processos: {
          include: {
            processo: {
              include: {
                contribuinte: true,
                tramitacoes: {
                  orderBy: { createdAt: 'desc' },
                  take: 3
                }
              }
            }
          },
          orderBy: { ordem: 'asc' }
        },
        sessao: {
          include: {
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
        }
      }
    })

    if (!pauta) {
      return NextResponse.json(
        { error: 'Pauta não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(pauta)
  } catch (error) {
    console.error('Erro ao buscar pauta:', error)
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

    // Apenas Admin e Funcionário podem editar pautas
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar pautas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Buscar pauta atual para auditoria
    const pautaAtual = await prisma.pauta.findUnique({
      where: { id: params.id },
      include: { processos: true }
    })

    if (!pautaAtual) {
      return NextResponse.json(
        { error: 'Pauta não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se pode ser editada (apenas pautas abertas)
    if (pautaAtual.status !== 'aberta') {
      return NextResponse.json(
        { error: 'Apenas pautas em status "aberta" podem ser editadas' },
        { status: 400 }
      )
    }

    // Preparar dados de atualização
    const updateData: PautaUpdateData = {
      ...body,
      updatedAt: new Date()
    }

    const pautaAtualizada = await prisma.pauta.update({
      where: { id: params.id },
      data: updateData,
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
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Pauta',
        entidadeId: params.id,
        dadosAnteriores: {
          numero: pautaAtual.numero,
          dataPauta: pautaAtual.dataPauta,
          status: pautaAtual.status,
          observacoes: pautaAtual.observacoes
        },
        dadosNovos: {
          numero: pautaAtualizada.numero,
          dataPauta: pautaAtualizada.dataPauta,
          status: pautaAtualizada.status,
          observacoes: pautaAtualizada.observacoes
        }
      }
    })

    return NextResponse.json(pautaAtualizada)
  } catch (error) {
    console.error('Erro ao atualizar pauta:', error)
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

    // Apenas Admin pode deletar pautas
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar pautas' },
        { status: 403 }
      )
    }

    const pauta = await prisma.pauta.findUnique({
      where: { id: params.id },
      include: { 
        processos: true,
        sessao: true
      }
    })

    if (!pauta) {
      return NextResponse.json(
        { error: 'Pauta não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se pode ser deletada (apenas pautas abertas sem sessão)
    if (pauta.status !== 'aberta' || pauta.sessao) {
      return NextResponse.json(
        { error: 'Não é possível deletar pautas que já têm sessão ou estão finalizadas' },
        { status: 400 }
      )
    }

    // Retornar processos ao status anterior
    const processosIds = pauta.processos.map(p => p.processoId)
    await prisma.processo.updateMany({
      where: { id: { in: processosIds } },
      data: { status: 'EM_ANALISE' }
    })

    await prisma.pauta.delete({
      where: { id: params.id }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Pauta',
        entidadeId: params.id,
        dadosAnteriores: {
          numero: pauta.numero,
          dataPauta: pauta.dataPauta,
          status: pauta.status,
          totalProcessos: pauta.processos.length
        }
      }
    })

    return NextResponse.json({ message: 'Pauta deletada com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar pauta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}