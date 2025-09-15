import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    
    const pauta = await prisma.pauta.findUnique({
      where: { id },
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
                        id: true,
                        name: true
                      }
                    }
                  }
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
                },
                votos: {
                  include: {
                    conselheiro: true
                  },
                  orderBy: { ordemApresentacao: 'asc' }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            presidente: {
              select: {
                id: true,
                nome: true,
                email: true,
                cargo: true
              }
            },
            conselheiros: {
              select: {
                id: true,
                nome: true,
                email: true,
                cargo: true
              }
            }
          }
        },
        historicos: {
          include: {
            usuario: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!pauta) {
      return NextResponse.json({ error: 'Pauta não encontrada' }, { status: 404 })
    }

    // Converter valores Decimal para number antes de retornar
    const pautaSerializada = {
      ...pauta,
      processos: pauta.processos.map(processoPauta => ({
        ...processoPauta,
        processo: {
          ...processoPauta.processo,
          valorOriginal: processoPauta.processo.valorOriginal ? Number(processoPauta.processo.valorOriginal) : null,
          valorNegociado: processoPauta.processo.valorNegociado ? Number(processoPauta.processo.valorNegociado) : null
        }
      }))
    }

    return NextResponse.json(pautaSerializada)
  } catch (error) {
    console.error('Erro ao buscar pauta:', error)
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
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para excluir pautas' },
        { status: 403 }
      )
    }

    const { id } = await params

    const pauta = await prisma.pauta.findUnique({
      where: { id },
      include: {
        processos: true,
        sessao: true
      }
    })

    if (!pauta) {
      return NextResponse.json({ error: 'Pauta não encontrada' }, { status: 404 })
    }

    if (pauta.status !== 'aberta') {
      return NextResponse.json(
        { error: 'Apenas pautas abertas podem ser excluídas' },
        { status: 400 }
      )
    }

    if (pauta.sessao) {
      return NextResponse.json(
        { error: 'Não é possível excluir uma pauta que já teve sua sessão iniciada' },
        { status: 400 }
      )
    }

    const processosIds = pauta.processos.map(p => p.processoId)

    await prisma.$transaction(async (tx) => {
      // Primeiro, deletar os processos da pauta (ProcessoPauta)
      await tx.processoPauta.deleteMany({
        where: { pautaId: id }
      })

      // Remover históricos criados quando os processos foram incluídos na pauta
      await tx.$queryRaw`
        DELETE FROM "HistoricoProcesso" 
        WHERE "processoId" = ANY(${processosIds}) 
        AND "titulo" = 'Processo incluído em pauta' 
        AND "tipo" = 'PAUTA'
      `

      // Restaurar status dos processos
      await tx.processo.updateMany({
        where: { id: { in: processosIds } },
        data: { status: 'EM_ANALISE' }
      })

      // Criar histórico de exclusão da pauta para cada processo
      await Promise.all(
        processosIds.map(processoId => 
          tx.$queryRaw`
            INSERT INTO "HistoricoProcesso" ("id", "processoId", "usuarioId", "titulo", "descricao", "tipo", "createdAt")
            VALUES (gen_random_uuid(), ${processoId}, ${user.id}, ${'Processo removido de pauta'}, ${`Processo removido da ${pauta.numero} que foi excluída`}, ${'PAUTA'}, ${new Date()})
          `
        )
      )

      // Criar histórico de exclusão antes de deletar
      await tx.historicoPauta.create({
        data: {
          pautaId: id,
          usuarioId: user.id,
          titulo: 'Pauta excluída',
          descricao: `Pauta ${pauta.numero} excluída e ${pauta.processos.length} processo${pauta.processos.length !== 1 ? 's' : ''} retornado${pauta.processos.length !== 1 ? '' : ''} ao status anterior`,
          tipo: 'EXCLUSAO'
        }
      })

      // Por último, deletar a pauta (o histórico será deletado em cascata)
      await tx.pauta.delete({
        where: { id }
      })
    })

    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Pauta',
        entidadeId: id,
        dadosAnteriores: {
          numero: pauta.numero,
          dataPauta: pauta.dataPauta,
          totalProcessos: pauta.processos.length,
          processos: processosIds
        }
      }
    })

    return NextResponse.json({ message: 'Pauta excluída com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir pauta:', error)
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

    const { id } = await params
    const body = await request.json()

    // Buscar a pauta atual
    const pautaAtual = await prisma.pauta.findUnique({
      where: { id }
    })

    if (!pautaAtual) {
      return NextResponse.json({ error: 'Pauta não encontrada' }, { status: 404 })
    }

    // Verificar se a pauta pode ser editada (apenas pautas abertas)
    if (pautaAtual.status !== 'aberta') {
      return NextResponse.json(
        { error: 'Apenas pautas abertas podem ser editadas' },
        { status: 400 }
      )
    }

    // Validar dados de entrada
    const { numero, dataPauta, observacoes } = body

    if (!numero || !dataPauta) {
      return NextResponse.json(
        { error: 'Número e data da pauta são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se o novo número da pauta já existe (exceto para a própria pauta)
    if (numero !== pautaAtual.numero) {
      const existingPauta = await prisma.pauta.findFirst({
        where: { 
          numero,
          id: { not: id }
        }
      })

      if (existingPauta) {
        return NextResponse.json(
          { error: 'Número de pauta já existe' },
          { status: 400 }
        )
      }
    }

    // Atualizar a pauta
    const pautaAtualizada = await prisma.pauta.update({
      where: { id },
      data: {
        numero,
        dataPauta: new Date(dataPauta),
        observacoes: observacoes || null
      },
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

    // Criar histórico de alteração
    const alteracoes = []
    if (numero !== pautaAtual.numero) {
      alteracoes.push(`Número alterado de "${pautaAtual.numero}" para "${numero}"`)
    }
    if (new Date(dataPauta).getTime() !== pautaAtual.dataPauta.getTime()) {
      alteracoes.push(`Data alterada de ${pautaAtual.dataPauta.toLocaleDateString('pt-BR')} para ${new Date(dataPauta).toLocaleDateString('pt-BR')}`)
    }
    if ((observacoes || '') !== (pautaAtual.observacoes || '')) {
      alteracoes.push('Observações alteradas')
    }

    if (alteracoes.length > 0) {
      await prisma.historicoPauta.create({
        data: {
          pautaId: id,
          usuarioId: user.id,
          titulo: 'Pauta editada',
          descricao: alteracoes.join('; '),
          tipo: 'ALTERACAO'
        }
      })
    }

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Pauta',
        entidadeId: id,
        dadosAnteriores: {
          numero: pautaAtual.numero,
          dataPauta: pautaAtual.dataPauta,
          observacoes: pautaAtual.observacoes
        },
        dadosNovos: {
          numero,
          dataPauta: new Date(dataPauta),
          observacoes
        }
      }
    })

    // Converter valores Decimal para number antes de retornar
    const pautaAtualizadaSerializada = {
      ...pautaAtualizada,
      processos: pautaAtualizada.processos.map(processoPauta => ({
        ...processoPauta,
        processo: {
          ...processoPauta.processo,
          valorOriginal: processoPauta.processo.valorOriginal ? Number(processoPauta.processo.valorOriginal) : null,
          valorNegociado: processoPauta.processo.valorNegociado ? Number(processoPauta.processo.valorNegociado) : null
        }
      }))
    }

    return NextResponse.json(pautaAtualizadaSerializada)
  } catch (error) {
    console.error('Erro ao atualizar pauta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}