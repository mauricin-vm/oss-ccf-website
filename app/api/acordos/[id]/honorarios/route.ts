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
    // Apenas Admin e Funcionário podem editar honorários
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar honorários' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    if (!body.honorariosDataVencimento) {
      return NextResponse.json(
        { error: 'Data de vencimento dos honorários é obrigatória' },
        { status: 400 }
      )
    }

    // Verificar se o acordo existe
    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: true,
        transacao: true,
        compensacao: true,
        dacao: true
      }
    })

    if (!acordo) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o acordo tem honorários baseado no tipo
    let temHonorarios = false

    if (acordo.tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
      temHonorarios = acordo.compensacao.honorariosValor !== null && Number(acordo.compensacao.honorariosValor) > 0
    } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
      temHonorarios = acordo.dacao.honorariosValor !== null && Number(acordo.dacao.honorariosValor) > 0
    } else {
      return NextResponse.json(
        { error: 'Apenas acordos de compensação e dação têm controle de honorários' },
        { status: 400 }
      )
    }

    if (!temHonorarios) {
      return NextResponse.json(
        { error: 'Este acordo não possui honorários' },
        { status: 400 }
      )
    }

    // Verificar se o acordo pode ser editado
    if (acordo.status === 'cancelado' || acordo.status === 'cumprido') {
      return NextResponse.json(
        { error: 'Acordos cancelados ou cumpridos não podem ser editados' },
        { status: 400 }
      )
    }

    // Ajustar timezone das datas
    const honorariosDataVencimento = new Date(body.honorariosDataVencimento)
    honorariosDataVencimento.setHours(12, 0, 0, 0)

    let honorariosDataPagamento = null
    if (body.honorariosDataPagamento) {
      honorariosDataPagamento = new Date(body.honorariosDataPagamento)
      honorariosDataPagamento.setHours(12, 0, 0, 0)
    }

    // Usar transação para atualizar honorários e verificar se acordo foi cumprido
    await prisma.$transaction(async (tx) => {
      // Atualizar honorários baseado no tipo de processo
      if (acordo.tipoProcesso === 'COMPENSACAO') {
        await tx.acordoCompensacao.update({
          where: { acordoId: id },
          data: {
            honorariosDataVencimento: honorariosDataVencimento,
            honorariosDataPagamento: honorariosDataPagamento
          }
        })
      } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO') {
        await tx.acordoDacao.update({
          where: { acordoId: id },
          data: {
            honorariosDataVencimento: honorariosDataVencimento,
            honorariosDataPagamento: honorariosDataPagamento
          }
        })
      }

      // Para dação e compensação, não fazemos conclusão automática
      // Apenas registramos o pagamento dos honorários
      // O usuário deve usar o botão "Concluir Acordo" quando todos os pagamentos estiverem em dia
    })

    // Log de auditoria
    let entidadeNome = ''
    let entidadeId = ''
    let dadosAnteriores = {}

    if (acordo.tipoProcesso === 'COMPENSACAO') {
      entidadeNome = 'AcordoCompensacao'
      entidadeId = acordo.compensacao?.id || ''
      dadosAnteriores = {
        honorariosDataVencimento: acordo.compensacao?.honorariosDataVencimento,
        honorariosDataPagamento: acordo.compensacao?.honorariosDataPagamento
      }
    } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO') {
      entidadeNome = 'AcordoDacao'
      entidadeId = acordo.dacao?.id || ''
      dadosAnteriores = {
        honorariosDataVencimento: acordo.dacao?.honorariosDataVencimento,
        honorariosDataPagamento: acordo.dacao?.honorariosDataPagamento
      }
    }

    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: entidadeNome,
        entidadeId: entidadeId,
        dadosAnteriores: dadosAnteriores,
        dadosNovos: {
          honorariosDataVencimento: honorariosDataVencimento,
          honorariosDataPagamento: honorariosDataPagamento,
          processo: acordo.processo.numero
        }
      }
    })

    // Buscar acordo atualizado para retornar
    const acordoAtualizado = await prisma.acordo.findUnique({
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
        },
        transacao: true,
        compensacao: true,
        dacao: true,
        creditos: true,
        inscricoes: {
          include: {
            debitos: true
          }
        }
      }
    })

    if (!acordoAtualizado) {
      return NextResponse.json(
        { error: 'Erro ao buscar acordo atualizado' },
        { status: 500 }
      )
    }

    // Processar dados específicos de compensação
    if (acordoAtualizado.tipoProcesso === 'COMPENSACAO' && acordoAtualizado.compensacao) {
      const compensacao = acordoAtualizado.compensacao

      const acordoEnriquecido = {
        ...acordoAtualizado,
        compensacaoDetails: {
          custasAdvocaticias: Number(compensacao.custasAdvocaticias) || 0,
          custasDataVencimento: compensacao.custasDataVencimento ? compensacao.custasDataVencimento.toISOString() : null,
          custasDataPagamento: compensacao.custasDataPagamento ? compensacao.custasDataPagamento.toISOString() : null,
          honorariosValor: Number(compensacao.honorariosValor) || 0,
          honorariosMetodoPagamento: compensacao.honorariosMetodoPagamento,
          honorariosParcelas: compensacao.honorariosParcelas,
          honorariosDataVencimento: compensacao.honorariosDataVencimento ? compensacao.honorariosDataVencimento.toISOString() : null,
          honorariosDataPagamento: compensacao.honorariosDataPagamento ? compensacao.honorariosDataPagamento.toISOString() : null
        }
      }

      return NextResponse.json(acordoEnriquecido)
    }

    // Processar dados específicos de dação em pagamento
    if (acordoAtualizado.tipoProcesso === 'DACAO_PAGAMENTO' && acordoAtualizado.dacao) {
      const dacao = acordoAtualizado.dacao

      const acordoEnriquecido = {
        ...acordoAtualizado,
        dacaoDetails: {
          custasAdvocaticias: Number(dacao.custasAdvocaticias) || 0,
          custasDataVencimento: dacao.custasDataVencimento ? dacao.custasDataVencimento.toISOString() : null,
          custasDataPagamento: dacao.custasDataPagamento ? dacao.custasDataPagamento.toISOString() : null,
          honorariosValor: Number(dacao.honorariosValor) || 0,
          honorariosMetodoPagamento: dacao.honorariosMetodoPagamento,
          honorariosParcelas: dacao.honorariosParcelas,
          honorariosDataVencimento: dacao.honorariosDataVencimento ? dacao.honorariosDataVencimento.toISOString() : null,
          honorariosDataPagamento: dacao.honorariosDataPagamento ? dacao.honorariosDataPagamento.toISOString() : null
        }
      }

      return NextResponse.json(acordoEnriquecido)
    }

    return NextResponse.json(acordoAtualizado)
  } catch (error) {
    console.error('Erro ao atualizar honorários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}