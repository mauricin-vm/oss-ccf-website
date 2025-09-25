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
    // Apenas Admin e Funcionário podem editar custas
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar custas' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    if (!body.custasDataVencimento) {
      return NextResponse.json(
        { error: 'Data de vencimento é obrigatória' },
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

    // Verificar se o acordo tem custas baseado no tipo
    let temCustas = false
    let valorCustas = 0

    if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && acordo.transacao) {
      temCustas = acordo.transacao.custasAdvocaticias !== null && acordo.transacao.custasAdvocaticias > 0
      valorCustas = Number(acordo.transacao.custasAdvocaticias) || 0
    } else if (acordo.tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
      temCustas = acordo.compensacao.custasAdvocaticias !== null && acordo.compensacao.custasAdvocaticias > 0
      valorCustas = Number(acordo.compensacao.custasAdvocaticias) || 0
    } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
      temCustas = acordo.dacao.custasAdvocaticias !== null && acordo.dacao.custasAdvocaticias > 0
      valorCustas = Number(acordo.dacao.custasAdvocaticias) || 0
    }

    if (!temCustas) {
      return NextResponse.json(
        { error: 'Este acordo não possui custas' },
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

    // Atualizar data de vencimento das custas
    const custasDataVencimento = new Date(body.custasDataVencimento)
    custasDataVencimento.setHours(12, 0, 0, 0) // Ajustar timezone

    let custasDataPagamento = null
    if (body.custasDataPagamento) {
      custasDataPagamento = new Date(body.custasDataPagamento)
      custasDataPagamento.setHours(12, 0, 0, 0) // Ajustar timezone
    }

    // Usar transação para atualizar custas e verificar se acordo foi cumprido
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar custas baseado no tipo de processo
      if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
        await tx.acordoTransacao.update({
          where: { acordoId: id },
          data: {
            custasDataVencimento: custasDataVencimento,
            custasDataPagamento: custasDataPagamento
          }
        })
      } else if (acordo.tipoProcesso === 'COMPENSACAO') {
        await tx.acordoCompensacao.update({
          where: { acordoId: id },
          data: {
            custasDataVencimento: custasDataVencimento,
            custasDataPagamento: custasDataPagamento
          }
        })
      } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO') {
        await tx.acordoDacao.update({
          where: { acordoId: id },
          data: {
            custasDataVencimento: custasDataVencimento,
            custasDataPagamento: custasDataPagamento
          }
        })
      }

      // Se custas foram marcadas como pagas, verificar se acordo pode ser cumprido
      if (custasDataPagamento) {
        const custasJaEstavasPagas = (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && acordo.transacao?.custasDataPagamento) ||
                                     (acordo.tipoProcesso === 'COMPENSACAO' && acordo.compensacao?.custasDataPagamento) ||
                                     (acordo.tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao?.custasDataPagamento)

        if (!custasJaEstavasPagas) {
          if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
            // Para transação, verificar se todas as parcelas foram pagas
            const todasParcelas = await tx.parcela.findMany({
              where: { acordoId: id }
            })
            const todasParcelasPagas = todasParcelas.every(p => p.status === 'PAGO')

            if (todasParcelasPagas && acordo.status === 'ativo') {
              await tx.acordo.update({
                where: { id },
                data: { status: 'cumprido' }
              })
              await tx.processo.update({
                where: { id: acordo.processoId },
                data: { status: 'CONCLUIDO' }
              })
              await tx.historicoProcesso.create({
                data: {
                  processoId: acordo.processoId,
                  usuarioId: user.id,
                  titulo: 'Acordo de Pagamento Cumprido',
                  descricao: 'Todas as parcelas e custas foram pagas. Acordo cumprido integralmente.',
                  tipo: 'ACORDO'
                }
              })
            }
          }
          // Para compensação e dação, não fazemos conclusão automática
          // O usuário deve usar o botão "Concluir Acordo" quando todos os pagamentos estiverem em dia
        }
      }
    })

    // Log de auditoria baseado no tipo de processo
    let entidadeNome = ''
    let entidadeId = ''
    let dadosAnteriores = {}

    if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      entidadeNome = 'AcordoTransacao'
      entidadeId = acordo.transacao?.id || ''
      dadosAnteriores = {
        custasDataVencimento: acordo.transacao?.custasDataVencimento,
        custasDataPagamento: acordo.transacao?.custasDataPagamento
      }
    } else if (acordo.tipoProcesso === 'COMPENSACAO') {
      entidadeNome = 'AcordoCompensacao'
      entidadeId = acordo.compensacao?.id || ''
      dadosAnteriores = {
        custasDataVencimento: acordo.compensacao?.custasDataVencimento,
        custasDataPagamento: acordo.compensacao?.custasDataPagamento
      }
    } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO') {
      entidadeNome = 'AcordoDacao'
      entidadeId = acordo.dacao?.id || ''
      dadosAnteriores = {
        custasDataVencimento: acordo.dacao?.custasDataVencimento,
        custasDataPagamento: acordo.dacao?.custasDataPagamento
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
          custasDataVencimento: custasDataVencimento,
          custasDataPagamento: custasDataPagamento,
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

    // Processar dados específicos baseado no tipo de processo
    if (acordoAtualizado.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && acordoAtualizado.transacao) {
      const transacao = acordoAtualizado.transacao

      // Calcular valores baseados nos dados da transação
      const valorTotal = acordoAtualizado.inscricoes.reduce((total, inscricao) => {
        return total + inscricao.debitos.reduce((subtotal, debito) => {
          return subtotal + Number(debito.valorLancado)
        }, 0)
      }, 0)

      const valorProposto = Number(transacao.valorTotalProposto)
      const valorDesconto = valorTotal - valorProposto
      const valorEntrada = Number(transacao.valorEntrada) || 0
      const quantidadeParcelas = transacao.quantidadeParcelas || 1
      const metodoPagamento = transacao.metodoPagamento

      // Adicionar campos calculados ao acordo
      const acordoEnriquecido = {
        ...acordoAtualizado,
        // Campos para compatibilidade com o frontend
        valorTotal: valorTotal,
        valorFinal: valorProposto,
        valorDesconto: valorDesconto,
        valorEntrada: valorEntrada,
        modalidadePagamento: metodoPagamento,
        numeroParcelas: quantidadeParcelas,
        // Dados da transação para cálculos detalhados
        transacaoDetails: {
          valorTotalInscricoes: valorTotal,
          valorTotalProposto: valorProposto,
          desconto: valorDesconto,
          percentualDesconto: valorTotal > 0 ? (valorDesconto / valorTotal) * 100 : 0,
          entrada: valorEntrada,
          custasAdvocaticias: Number(transacao.custasAdvocaticias) || 0,
          custasDataVencimento: transacao.custasDataVencimento ? transacao.custasDataVencimento.toISOString() : null,
          custasDataPagamento: transacao.custasDataPagamento ? transacao.custasDataPagamento.toISOString() : null,
          honorariosValor: Number(transacao.honorariosValor) || 0,
          honorariosMetodoPagamento: transacao.honorariosMetodoPagamento,
          honorariosParcelas: transacao.honorariosParcelas,
          totalGeral: valorProposto + (Number(transacao.custasAdvocaticias) || 0) + (Number(transacao.honorariosValor) || 0)
        }
      }

      return NextResponse.json(acordoEnriquecido)
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
          honorariosParcelas: compensacao.honorariosParcelas
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
          honorariosParcelas: dacao.honorariosParcelas
        }
      }

      return NextResponse.json(acordoEnriquecido)
    }

    return NextResponse.json(acordoAtualizado)
  } catch (error) {
    console.error('Erro ao atualizar custas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}