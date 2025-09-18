import { prisma } from '@/lib/db'
import { ReportsClient } from '@/components/reports/reports-client'

async function getDashboardData(filters?: { dataInicio?: Date, dataFim?: Date }) {
  // Criar filtro de período baseado nas datas
  const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {}
  if (filters?.dataInicio && filters?.dataFim) {
    dateFilter.createdAt = {
      gte: filters.dataInicio,
      lte: filters.dataFim
    }
  } else if (filters?.dataInicio) {
    dateFilter.createdAt = {
      gte: filters.dataInicio
    }
  } else if (filters?.dataFim) {
    dateFilter.createdAt = {
      lte: filters.dataFim
    }
  }

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

    // Parcelas vencidas (data vencimento passou e não está pago)
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

    // Processos por status (para pipeline)
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

    // Valor dos acordos cumpridos (compensação e dação)
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

    // Decisões por tipo (para gráfico de resultados)
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
        _sum: { valorTotal: tipo === 'TRANSACAO_EXCEPCIONAL' ? ('valorFinal' in valueSum._sum ? (valueSum._sum.valorFinal || 0) : 0) : ('valorTotal' in valueSum._sum ? (valueSum._sum.valorTotal || 0) : 0) }
      }
    })),

    // Valores por resultado (baseado nas decisões)
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
          // Valores para compensação e dação (usa valorTotal)
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

          // Valores para transação excepcional (usa valorFinal)
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

    // Evolução mensal da arrecadação - dados reais do banco
    (async () => {
      const evolucaoMensal = []
      const dataAtual = new Date()

      for (let i = 11; i >= 0; i--) {
        const inicioMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() - i, 1)
        const fimMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() - i + 1, 0, 23, 59, 59)

        // Para COMPENSACAO e DACAO: considerar apenas acordos cumpridos
        const acordosCompDacao = await prisma.acordo.findMany({
          where: {
            status: 'cumprido',
            dataAssinatura: {
              gte: inicioMes,
              lte: fimMes
            },
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

        // Para TRANSACAO_EXCEPCIONAL: considerar apenas parcelas pagas (de qualquer acordo)
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

        // Calcular valores
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
      }

      return evolucaoMensal
    })()
  ])

  const valorParcelas = Number(valorRecebidoParcelas._sum.valor || 0)
  const valorAcordos = Number(valorAcordosCumpridos._sum.valorTotal || 0)
  const valorRecebidoTotal = valorParcelas + valorAcordos

  // Calcular valor total correto: Acordos (Comp/Dação) + Acordos (Transação)
  const valorTotalCalculado = Number(valorAcordosCompDacao._sum.valorTotal || 0) + Number(valorAcordosTransacao._sum.valorFinal || 0)

  return {
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
}

async function getRelatóriosRecentes() {
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() - 30) // Últimos 30 dias

  return {
    processosRecentes: await prisma.processo.count({
      where: { createdAt: { gte: dataLimite } }
    }),
    acordosRecentes: await prisma.acordo.count({
      where: { createdAt: { gte: dataLimite } }
    }),
    pagamentosRecentes: await prisma.parcela.count({
      where: { 
        createdAt: { gte: dataLimite },
        status: 'PAGO'
      }
    }),
    sessoesRecentes: await prisma.sessaoJulgamento.count({
      where: { createdAt: { gte: dataLimite } }
    })
  }
}

export default async function RelatoriosPage() {
  const dashboardData = await getDashboardData()
  const relatóriosRecentes = await getRelatóriosRecentes()

  return (
    <ReportsClient
      initialData={dashboardData}
      relatóriosRecentes={relatóriosRecentes}
    />
  )
}