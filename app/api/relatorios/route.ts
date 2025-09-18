import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  // Criar filtro de período baseado nas datas
  const dateFilter: any = {}
  if (dataInicio && dataFim) {
    dateFilter.createdAt = {
      gte: new Date(dataInicio),
      lte: new Date(dataFim)
    }
  } else if (dataInicio) {
    dateFilter.createdAt = {
      gte: new Date(dataInicio)
    }
  } else if (dataFim) {
    dateFilter.createdAt = {
      lte: new Date(dataFim)
    }
  }

  try {
    const [
      totalProcessos,
      totalPautas,
      totalSessoes,
      totalAcordos,
      totalParcelas,
      parcelasAbertas,
      parcelasVencidas,
      parcelasPagas,
      processosPorTipo,
      processosPorStatus,
      sessoesAtivas,
      acordosVencidos,
      valorAcordosCompDacao,
      valorAcordosTransacao,
      valorRecebidoParcelas,
      valorAcordosCumpridos,
      decisoesPorTipo,
      valoresPorTipoProcesso,
      valoresPorResultado,
      evolucaoMensal
    ] = await Promise.all([
      // Total de processos
      prisma.processo.count({
        where: dateFilter
      }),

      // Total de pautas
      prisma.pauta.count({
        where: dateFilter
      }),

      // Total de sessões
      prisma.sessaoJulgamento.count({
        where: dateFilter
      }),

      // Total de acordos
      prisma.acordo.count({
        where: dateFilter
      }),

      // Total de parcelas
      prisma.parcela.count({
        where: dateFilter
      }),

      // Parcelas abertas (status PENDENTE)
      prisma.parcela.count({
        where: {
          status: 'PENDENTE',
          ...dateFilter
        }
      }),

      // Parcelas vencidas
      prisma.parcela.count({
        where: {
          dataVencimento: { lt: new Date() },
          status: { not: 'PAGO' },
          ...dateFilter
        }
      }),

      // Parcelas pagas
      prisma.parcela.count({
        where: {
          status: 'PAGO',
          ...dateFilter
        }
      }),

      // Processos por tipo
      prisma.processo.groupBy({
        by: ['tipo'],
        _count: { id: true },
        where: dateFilter
      }),

      // Processos por status
      prisma.processo.groupBy({
        by: ['status'],
        _count: { id: true },
        where: dateFilter
      }),

      // Sessões ativas
      prisma.sessaoJulgamento.count({
        where: {
          dataFim: null,
          ...dateFilter
        }
      }),

      // Acordos vencidos
      prisma.acordo.count({
        where: {
          dataVencimento: { lt: new Date() },
          ...dateFilter
        }
      }),

      // Valor total dos acordos de compensação e dação
      prisma.acordo.aggregate({
        where: {
          processo: {
            tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] }
          },
          ...dateFilter
        },
        _sum: { valorTotal: true }
      }),

      // Valor total dos acordos de transação excepcional
      prisma.acordo.aggregate({
        where: {
          processo: {
            tipo: 'TRANSACAO_EXCEPCIONAL'
          },
          ...dateFilter
        },
        _sum: { valorFinal: true }
      }),

      // Valor recebido (parcelas pagas)
      prisma.parcela.aggregate({
        where: {
          status: 'PAGO',
          ...dateFilter
        },
        _sum: { valor: true }
      }),

      // Valor dos acordos cumpridos
      prisma.acordo.aggregate({
        where: {
          status: 'cumprido',
          processo: {
            tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] }
          },
          ...dateFilter
        },
        _sum: { valorTotal: true }
      }),

      // Decisões por tipo
      prisma.decisao.groupBy({
        by: ['tipoDecisao'],
        _count: { id: true },
        where: {
          tipoDecisao: { not: null },
          ...dateFilter
        }
      }),

      // Valores por tipo de processo
      Promise.all([
        { tipo: 'COMPENSACAO' as const },
        { tipo: 'DACAO_PAGAMENTO' as const },
        { tipo: 'TRANSACAO_EXCEPCIONAL' as const }
      ].map(async ({ tipo }) => {
        const [count, valueSum] = await Promise.all([
          prisma.processo.count({
            where: {
              tipo,
              ...dateFilter
            }
          }),
          prisma.acordo.aggregate({
            where: {
              processo: { tipo },
              ...dateFilter
            },
            _sum: tipo === 'TRANSACAO_EXCEPCIONAL' ? { valorFinal: true } : { valorTotal: true }
          })
        ])
        return {
          tipo,
          _count: count,
          _sum: { valorTotal: tipo === 'TRANSACAO_EXCEPCIONAL' ? (valueSum._sum.valorFinal || 0) : (valueSum._sum.valorTotal || 0) }
        }
      })),

      // Valores por resultado
      prisma.decisao.groupBy({
        by: ['tipoDecisao'],
        where: {
          tipoDecisao: { not: null },
          ...dateFilter
        }
      }).then(async (grupos) => {
        const resultados = []
        for (const grupo of grupos) {
          if (grupo.tipoDecisao) {
            const valorCompDacao = await prisma.acordo.aggregate({
              where: {
                processo: {
                  tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] },
                  decisoes: {
                    some: { tipoDecisao: grupo.tipoDecisao }
                  }
                },
                ...dateFilter
              },
              _sum: { valorTotal: true }
            })

            const valorTransacao = await prisma.acordo.aggregate({
              where: {
                processo: {
                  tipo: 'TRANSACAO_EXCEPCIONAL',
                  decisoes: {
                    some: { tipoDecisao: grupo.tipoDecisao }
                  }
                },
                ...dateFilter
              },
              _sum: { valorFinal: true }
            })

            const valorTotalCorreto = Number(valorCompDacao._sum.valorTotal || 0) + Number(valorTransacao._sum.valorFinal || 0)

            resultados.push({
              tipoDecisao: grupo.tipoDecisao,
              valorTotal: valorTotalCorreto
            })
          }
        }
        return resultados
      }),

      // Evolução mensal
      (async () => {
        const evolucaoMensal = []

        let endDate

        if (dataInicio || dataFim) {
          // Com filtros: último mês do filtro será a base
          endDate = dataFim ? new Date(dataFim) : new Date()

          // Garantir que endDate não seja maior que hoje
          const hoje = new Date()
          if (endDate > hoje) {
            endDate = hoje
          }
        } else {
          // Sem filtros: mês atual
          endDate = new Date()
        }

        // Sempre pegar os últimos 12 meses a partir do endDate
        const ultimoMes = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        const primeiroMes = new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() - 11, 1)

        let mesAtual = new Date(primeiroMes)

        while (mesAtual <= ultimoMes) {
          const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
          const fimMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0, 23, 59, 59)

          let filtroMes = {
            dataAssinatura: {
              gte: inicioMes,
              lte: fimMes
            }
          }

          const acordosCompDacao = await prisma.acordo.findMany({
            where: {
              status: 'cumprido',
              ...filtroMes,
              processo: {
                tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] }
              }
            },
            select: {
              valorTotal: true,
              processo: {
                select: {
                  tipo: true
                }
              }
            }
          })

          const parcelasTransacao = await prisma.parcela.findMany({
            where: {
              status: 'PAGO',
              dataPagamento: {
                gte: inicioMes,
                lte: fimMes
              },
              acordo: {
                processo: {
                  tipo: 'TRANSACAO_EXCEPCIONAL'
                }
              }
            },
            select: {
              valor: true
            }
          })

          const valorAcordosCompDacao = acordosCompDacao.reduce((total, acordo) => {
            return total + Number(acordo.valorTotal || 0)
          }, 0)

          const valorParcelasTransacao = parcelasTransacao.reduce((total, parcela) => {
            return total + Number(parcela.valor || 0)
          }, 0)

          const valorTotal = valorAcordosCompDacao + valorParcelasTransacao

          evolucaoMensal.push({
            mes: inicioMes.getMonth(),
            ano: inicioMes.getFullYear(),
            valor: valorTotal,
            acordos: {
              valor: valorAcordosCompDacao,
              quantidade: acordosCompDacao.length
            },
            parcelas: {
              valor: valorParcelasTransacao,
              quantidade: parcelasTransacao.length
            },
            total: {
              valor: valorTotal,
              quantidade: acordosCompDacao.length + parcelasTransacao.length
            }
          })

          // Avançar para o próximo mês
          mesAtual.setMonth(mesAtual.getMonth() + 1)
        }


        return evolucaoMensal
      })()
    ])

    const valorParcelas = Number(valorRecebidoParcelas._sum.valor || 0)
    const valorAcordos = Number(valorAcordosCumpridos._sum.valorTotal || 0)
    const valorRecebidoTotal = valorParcelas + valorAcordos

    const valorTotalCalculado = Number(valorAcordosCompDacao._sum.valorTotal || 0) + Number(valorAcordosTransacao._sum.valorFinal || 0)

    const data = {
      totais: {
        processos: totalProcessos,
        pautas: totalPautas,
        sessoes: totalSessoes,
        acordos: totalAcordos
      },
      parcelas: {
        total: totalParcelas,
        abertas: parcelasAbertas,
        vencidas: parcelasVencidas,
        pagas: parcelasPagas
      },
      processosPorTipo,
      processosPorStatus,
      sessoesAtivas,
      acordosVencidos,
      valores: {
        totalAcordos: Number(valorTotalCalculado),
        recebido: Number(valorRecebidoTotal)
      },
      decisoesPorTipo,
      valoresPorTipoProcesso: valoresPorTipoProcesso.map(item => ({
        ...item,
        _sum: {
          valorTotal: Number(item._sum.valorTotal)
        }
      })),
      valoresPorResultado: valoresPorResultado.map(item => ({
        ...item,
        valorTotal: Number(item.valorTotal)
      })),
      evolucaoMensal: evolucaoMensal.map(item => ({
        ...item,
        valor: Number(item.valor),
        acordos: {
          valor: Number(item.acordos.valor),
          quantidade: item.acordos.quantidade
        },
        parcelas: {
          valor: Number(item.parcelas.valor),
          quantidade: item.parcelas.quantidade
        },
        total: {
          valor: Number(item.total.valor),
          quantidade: item.total.quantidade
        }
      }))
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao buscar dados dos relatórios:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}