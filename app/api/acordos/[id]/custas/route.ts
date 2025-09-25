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
        { error: 'Sem permissão para editar custas advocatícias' },
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

    // Verificar se o acordo existe e tem transação
    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: true,
        transacao: true
      }
    })

    if (!acordo) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }

    if (!acordo.transacao) {
      return NextResponse.json(
        { error: 'Apenas acordos de transação excepcional têm custas advocatícias' },
        { status: 400 }
      )
    }

    if (acordo.transacao.custasAdvocaticias === null || acordo.transacao.custasAdvocaticias <= 0) {
      return NextResponse.json(
        { error: 'Este acordo não possui custas advocatícias' },
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
      // Atualizar custas
      await tx.acordoTransacao.update({
        where: { acordoId: id },
        data: {
          custasDataVencimento: custasDataVencimento,
          custasDataPagamento: custasDataPagamento
        }
      })

      // Se custas foram marcadas como pagas, verificar se o acordo pode ser marcado como cumprido
      if (custasDataPagamento && !acordo.transacao.custasDataPagamento) {
        // Verificar se todas as parcelas foram pagas
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
          // Registrar no histórico do processo
          await tx.historicoProcesso.create({
            data: {
              processoId: acordo.processoId,
              usuarioId: user.id,
              titulo: 'Acordo de Pagamento Cumprido',
              descricao: 'Todas as parcelas e custas advocatícias foram pagas. Acordo cumprido integralmente.',
              tipo: 'ACORDO'
            }
          })
        }
      }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'AcordoTransacao',
        entidadeId: acordo.transacao.id,
        dadosAnteriores: {
          custasDataVencimento: acordo.transacao.custasDataVencimento,
          custasDataPagamento: acordo.transacao.custasDataPagamento
        },
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

    // Processar dados específicos da transação excepcional se necessário
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

    return NextResponse.json(acordoAtualizado)
  } catch (error) {
    console.error('Erro ao atualizar custas advocatícias:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}