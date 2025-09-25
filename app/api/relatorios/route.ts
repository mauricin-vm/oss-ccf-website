import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  // Criar filtro de período baseado nas datas
  const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {}
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
        where: {
          dataAssinatura: dateFilter.createdAt
        }
      }),

      // Total de parcelas (incluindo custas como 1 parcela adicional)
      (async () => {
        const acordoDateFilter = dateFilter.createdAt ? { dataAssinatura: dateFilter.createdAt } : {}
        const [totalParcelas, totalCustas] = await Promise.all([
          prisma.parcela.count({ where: dateFilter }),
          prisma.acordo.count({
            where: {
              ...acordoDateFilter,
              OR: [
                { compensacao: { custasAdvocaticias: { gt: 0 } } },
                { dacao: { custasAdvocaticias: { gt: 0 } } },
                { transacao: { custasAdvocaticias: { gt: 0 } } }
              ]
            }
          })
        ])
        return totalParcelas + totalCustas
      })(),

      // Parcelas abertas (status PENDENTE + custas não pagas)
      (async () => {
        const acordoDateFilter = dateFilter.createdAt ? { dataAssinatura: dateFilter.createdAt } : {}
        const [parcelasPendentes, custasAbertas] = await Promise.all([
          prisma.parcela.count({
            where: {
              status: 'PENDENTE',
              ...dateFilter
            }
          }),
          prisma.acordo.count({
            where: {
              ...acordoDateFilter,
              OR: [
                {
                  compensacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataPagamento: null
                  }
                },
                {
                  dacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataPagamento: null
                  }
                },
                {
                  transacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataPagamento: null
                  }
                }
              ]
            }
          })
        ])
        return parcelasPendentes + custasAbertas
      })(),

      // Parcelas vencidas (data vencimento passou e não está pago + custas vencidas)
      (async () => {
        const acordoDateFilter = dateFilter.createdAt ? { dataAssinatura: dateFilter.createdAt } : {}
        const [parcelasVencidas, custasVencidas] = await Promise.all([
          prisma.parcela.count({
            where: {
              dataVencimento: { lt: new Date() },
              status: { not: 'PAGO' },
              ...dateFilter
            }
          }),
          prisma.acordo.count({
            where: {
              ...acordoDateFilter,
              OR: [
                {
                  compensacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataVencimento: { lt: new Date() },
                    custasDataPagamento: null
                  }
                },
                {
                  dacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataVencimento: { lt: new Date() },
                    custasDataPagamento: null
                  }
                },
                {
                  transacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataVencimento: { lt: new Date() },
                    custasDataPagamento: null
                  }
                }
              ]
            }
          })
        ])
        return parcelasVencidas + custasVencidas
      })(),

      // Parcelas pagas (status PAGO + custas pagas)
      (async () => {
        const acordoDateFilter = dateFilter.createdAt ? { dataAssinatura: dateFilter.createdAt } : {}
        const [parcelasPagas, custasPagas] = await Promise.all([
          prisma.parcela.count({
            where: {
              status: 'PAGO',
              ...dateFilter
            }
          }),
          prisma.acordo.count({
            where: {
              ...acordoDateFilter,
              OR: [
                {
                  compensacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataPagamento: { not: null }
                  }
                },
                {
                  dacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataPagamento: { not: null }
                  }
                },
                {
                  transacao: {
                    custasAdvocaticias: { gt: 0 },
                    custasDataPagamento: { not: null }
                  }
                }
              ]
            }
          })
        ])
        return parcelasPagas + custasPagas
      })(),

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
          dataAssinatura: dateFilter.createdAt
        }
      }),

      // Valor total calculado dos acordos de compensação e dação com nova estrutura
      (async () => {
        const acordosCompDacao = await prisma.acordo.findMany({
          where: {
            processo: {
              tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] }
            },
            dataAssinatura: dateFilter.createdAt
          },
          include: {
            processo: { select: { tipo: true } },
            compensacao: true,
            dacao: true
          }
        })

        return {
          _sum: {
            valorTotal: acordosCompDacao.reduce((total, acordo) => {
              const tipoProcesso = acordo.processo?.tipo
              let valorAcordo = 0

              if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
                const valorCompensado = Number(acordo.compensacao.valorTotalDebitos || 0)
                const valorCustas = Number(acordo.compensacao.custasAdvocaticias || 0)
                const valorHonorarios = Number(acordo.compensacao.honorariosValor || 0)
                valorAcordo = valorCompensado + valorCustas + valorHonorarios
              } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
                const valorOferecido = Number(acordo.dacao.valorTotalOferecido || 0)
                const valorCustas = Number(acordo.dacao.custasAdvocaticias || 0)
                const valorHonorarios = Number(acordo.dacao.honorariosValor || 0)
                valorAcordo = valorOferecido + valorCustas + valorHonorarios
              }

              return total + valorAcordo
            }, 0)
          }
        }
      })(),

      // Valor total calculado dos acordos de transação excepcional com nova estrutura
      (async () => {
        const acordosTransacao = await prisma.acordo.findMany({
          where: {
            processo: {
              tipo: 'TRANSACAO_EXCEPCIONAL'
            },
            dataAssinatura: dateFilter.createdAt
          },
          include: {
            transacao: true,
            parcelas: {
              select: { valor: true }
            }
          }
        })

        return {
          _sum: {
            valorFinal: acordosTransacao.reduce((total, acordo) => {
              if (acordo.transacao) {
                const valorProposto = Number(acordo.transacao.valorTotalProposto || 0)
                const custasAdvocaticias = Number(acordo.transacao.custasAdvocaticias || 0)
                const honorarios = Number(acordo.transacao.honorariosValor || 0)
                return total + valorProposto + custasAdvocaticias + honorarios
              }
              return total
            }, 0)
          }
        }
      })(),

      // Valor recebido - nova lógica: parcelas + custas + honorários pagos + acordos cumpridos sem duplicação
      (async () => {
        const acordoDateFilter = dateFilter.createdAt ? { dataAssinatura: dateFilter.createdAt } : {}

        // 1. PARCELAS PAGAS (por data de pagamento) - TODAS as parcelas
        const parcelasPagas = await prisma.parcela.aggregate({
          where: {
            status: 'PAGO',
            ...dateFilter
          },
          _sum: { valor: true }
        })

        // 2. CUSTAS PAGAS (por data de pagamento) - de todos os tipos de acordo
        const [custasCompensacao, custasDacao, custasTransacao] = await Promise.all([
          prisma.acordo.findMany({
            where: {
              processo: { tipo: 'COMPENSACAO' },
              compensacao: {
                custasAdvocaticias: { gt: 0 },
                custasDataPagamento: { not: null }
              },
              ...acordoDateFilter
            },
            include: { compensacao: { select: { custasAdvocaticias: true } } }
          }),
          prisma.acordo.findMany({
            where: {
              processo: { tipo: 'DACAO_PAGAMENTO' },
              dacao: {
                custasAdvocaticias: { gt: 0 },
                custasDataPagamento: { not: null }
              },
              ...acordoDateFilter
            },
            include: { dacao: { select: { custasAdvocaticias: true } } }
          }),
          prisma.acordo.findMany({
            where: {
              processo: { tipo: 'TRANSACAO_EXCEPCIONAL' },
              transacao: {
                custasAdvocaticias: { gt: 0 },
                custasDataPagamento: { not: null }
              },
              ...acordoDateFilter
            },
            include: { transacao: { select: { custasAdvocaticias: true } } }
          })
        ])

        // 3. HONORÁRIOS PAGOS (por data de pagamento) - apenas COMPENSACAO e DACAO
        const [honorariosCompensacao, honorariosDacao] = await Promise.all([
          prisma.acordo.findMany({
            where: {
              processo: { tipo: 'COMPENSACAO' },
              compensacao: {
                honorariosValor: { gt: 0 },
                honorariosDataPagamento: { not: null }
              },
              ...acordoDateFilter
            },
            include: { compensacao: { select: { honorariosValor: true } } }
          }),
          prisma.acordo.findMany({
            where: {
              processo: { tipo: 'DACAO_PAGAMENTO' },
              dacao: {
                honorariosValor: { gt: 0 },
                honorariosDataPagamento: { not: null }
              },
              ...acordoDateFilter
            },
            include: { dacao: { select: { honorariosValor: true } } }
          })
        ])

        // 4. ACORDOS CUMPRIDOS (por data de assinatura) - apenas COMPENSACAO e DACAO, descontando custas/honorários
        const acordosCumpridos = await prisma.acordo.findMany({
          where: {
            status: 'cumprido',
            processo: {
              tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] }
            },
            ...acordoDateFilter
          },
          include: {
            processo: { select: { tipo: true } },
            compensacao: true,
            dacao: true
          }
        })

        // CALCULAR VALORES
        const valorParcelas = Number(parcelasPagas._sum.valor || 0)

        const valorCustas = [
          ...custasCompensacao.map(a => Number(a.compensacao?.custasAdvocaticias || 0)),
          ...custasDacao.map(a => Number(a.dacao?.custasAdvocaticias || 0)),
          ...custasTransacao.map(a => Number(a.transacao?.custasAdvocaticias || 0))
        ].reduce((total, valor) => total + valor, 0)

        const valorHonorarios = [
          ...honorariosCompensacao.map(a => Number(a.compensacao?.honorariosValor || 0)),
          ...honorariosDacao.map(a => Number(a.dacao?.honorariosValor || 0))
        ].reduce((total, valor) => total + valor, 0)

        const valorAcordosCumpridos = acordosCumpridos.reduce((total, acordo) => {
          const tipoProcesso = acordo.processo?.tipo
          let valorAcordo = 0

          if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
            // Apenas o valor principal, sem custas e honorários (já contados separadamente)
            valorAcordo = Number(acordo.compensacao.valorTotalDebitos || 0)
          } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
            // Apenas o valor principal, sem custas e honorários (já contados separadamente)
            valorAcordo = Number(acordo.dacao.valorTotalOferecido || 0)
          }

          return total + valorAcordo
        }, 0)

        const valorTotalRecebido = valorParcelas + valorCustas + valorHonorarios + valorAcordosCumpridos

        return { _sum: { valor: valorTotalRecebido } }
      })(),

      // Valor dos acordos cumpridos com nova estrutura
      (async () => {
        const acordosCumpridos = await prisma.acordo.findMany({
          where: {
            status: 'cumprido',
            processo: {
              tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] }
            },
            dataAssinatura: dateFilter.createdAt
          },
          include: {
            processo: { select: { tipo: true } },
            compensacao: true,
            dacao: true
          }
        })

        return {
          _sum: {
            valorTotal: acordosCumpridos.reduce((total, acordo) => {
              const tipoProcesso = acordo.processo?.tipo
              let valorAcordo = 0

              if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
                const valorCompensado = Number(acordo.compensacao.valorTotalDebitos || 0)
                const valorCustas = Number(acordo.compensacao.custasAdvocaticias || 0)
                const valorHonorarios = Number(acordo.compensacao.honorariosValor || 0)
                valorAcordo = valorCompensado + valorCustas + valorHonorarios
              } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
                const valorOferecido = Number(acordo.dacao.valorTotalOferecido || 0)
                const valorCustas = Number(acordo.dacao.custasAdvocaticias || 0)
                const valorHonorarios = Number(acordo.dacao.honorariosValor || 0)
                valorAcordo = valorOferecido + valorCustas + valorHonorarios
              }

              return total + valorAcordo
            }, 0)
          }
        }
      })(),

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
          (async () => {
            const acordos = await prisma.acordo.findMany({
              where: {
                processo: { tipo },
                dataAssinatura: dateFilter.createdAt
              },
              include: {
                processo: { select: { tipo: true } },
                compensacao: tipo === 'COMPENSACAO',
                dacao: tipo === 'DACAO_PAGAMENTO',
                transacao: tipo === 'TRANSACAO_EXCEPCIONAL',
                parcelas: tipo === 'TRANSACAO_EXCEPCIONAL' ? {
                  select: { valor: true }
                } : false
              }
            })

            const valorTotal = acordos.reduce((total, acordo) => {
              if (tipo === 'COMPENSACAO' && acordo.compensacao) {
                const valorCompensado = Number(acordo.compensacao.valorTotalDebitos || 0)
                const valorCustas = Number(acordo.compensacao.custasAdvocaticias || 0)
                const valorHonorarios = Number(acordo.compensacao.honorariosValor || 0)
                return total + valorCompensado + valorCustas + valorHonorarios
              } else if (tipo === 'DACAO_PAGAMENTO' && acordo.dacao) {
                const valorOferecido = Number(acordo.dacao.valorTotalOferecido || 0)
                const valorCustas = Number(acordo.dacao.custasAdvocaticias || 0)
                const valorHonorarios = Number(acordo.dacao.honorariosValor || 0)
                return total + valorOferecido + valorCustas + valorHonorarios
              } else if (tipo === 'TRANSACAO_EXCEPCIONAL' && acordo.transacao) {
                const valorProposto = Number(acordo.transacao.valorTotalProposto || 0)
                const custasAdvocaticias = Number(acordo.transacao.custasAdvocaticias || 0)
                const honorarios = Number(acordo.transacao.honorariosValor || 0)
                return total + valorProposto + custasAdvocaticias + honorarios
              }
              return total
            }, 0)

            return {
              _sum: tipo === 'TRANSACAO_EXCEPCIONAL'
                ? { valorFinal: valorTotal }
                : { valorTotal: valorTotal }
            }
          })()
        ])
        return {
          tipo,
          _count: count,
          _sum: { valorTotal: tipo === 'TRANSACAO_EXCEPCIONAL' ? ('valorFinal' in valueSum._sum ? (valueSum._sum.valorFinal || 0) : 0) : ('valorTotal' in valueSum._sum ? (valueSum._sum.valorTotal || 0) : 0) }
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
            let valorTotalCorreto = 0
            if (grupo.tipoDecisao === 'INDEFERIDO') {
              // Para indeferimento, calcular baseado nos valores configurados
              const processosIndeferidos = await prisma.processo.findMany({
                where: {
                  decisoes: {
                    some: { tipoDecisao: 'INDEFERIDO' }
                  },
                  createdAt: dateFilter.createdAt
                },
                select: {
                  tipo: true,
                  transacao: {
                    select: {
                      valorTotalProposto: true,
                      valorEntrada: true
                    }
                  },
                  inscricoes: {
                    select: {
                      debitos: {
                        select: {
                          valor: true
                        }
                      }
                    }
                  }
                }
              })

              valorTotalCorreto = processosIndeferidos.reduce((total, processo) => {
                let valorProcesso = 0

                if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && processo.transacao) {
                  // Para transação: Valor Total Proposto - Valor de Entrada
                  const valorTotalProposto = Number(processo.transacao.valorTotalProposto || 0)
                  const valorEntrada = Number(processo.transacao.valorEntrada || 0)
                  valorProcesso = valorTotalProposto - valorEntrada
                } else if ((processo.tipo === 'COMPENSACAO' || processo.tipo === 'DACAO_PAGAMENTO') && processo.inscricoes) {
                  // Para compensação e dação: total de valores das inscrições a compensar
                  valorProcesso = processo.inscricoes.reduce((totalInscricoes, inscricao) => {
                    return totalInscricoes + (inscricao.debitos?.reduce((totalDebitos, debito) => {
                      return totalDebitos + Number(debito.valor || 0)
                    }, 0) || 0)
                  }, 0)
                }

                return total + valorProcesso
              }, 0)
            } else {
              // Buscar acordos de compensação e dação
              const acordosCompDacao = await prisma.acordo.findMany({
                where: {
                  processo: {
                    tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] },
                    decisoes: {
                      some: { tipoDecisao: grupo.tipoDecisao }
                    }
                  },
                  dataAssinatura: dateFilter.createdAt
                },
                include: {
                  processo: { select: { tipo: true } },
                  compensacao: true,
                  dacao: true
                }
              })

              const valorCompDacao = acordosCompDacao.reduce((total, acordo) => {
                const tipoProcesso = acordo.processo?.tipo
                let valorAcordo = 0

                if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
                  const valorCompensado = Number(acordo.compensacao.valorTotalDebitos || 0)
                  const valorCustas = Number(acordo.compensacao.custasAdvocaticias || 0)
                  const valorHonorarios = Number(acordo.compensacao.honorariosValor || 0)
                  valorAcordo = valorCompensado + valorCustas + valorHonorarios
                } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
                  const valorOferecido = Number(acordo.dacao.valorTotalOferecido || 0)
                  const valorCustas = Number(acordo.dacao.custasAdvocaticias || 0)
                  const valorHonorarios = Number(acordo.dacao.honorariosValor || 0)
                  valorAcordo = valorOferecido + valorCustas + valorHonorarios
                }

                return total + valorAcordo
              }, 0)

              // Buscar acordos de transação excepcional
              const acordosTransacao = await prisma.acordo.findMany({
                where: {
                  processo: {
                    tipo: 'TRANSACAO_EXCEPCIONAL',
                    decisoes: {
                      some: { tipoDecisao: grupo.tipoDecisao }
                    }
                  },
                  dataAssinatura: dateFilter.createdAt
                },
                include: {
                  transacao: true,
                  parcelas: {
                    select: { valor: true }
                  }
                }
              })

              const valorTransacao = acordosTransacao.reduce((total, acordo) => {
                if (acordo.transacao) {
                  const valorProposto = Number(acordo.transacao.valorTotalProposto || 0)
                  const custasAdvocaticias = Number(acordo.transacao.custasAdvocaticias || 0)
                  const honorarios = Number(acordo.transacao.honorariosValor || 0)
                  return total + valorProposto + custasAdvocaticias + honorarios
                }
                return total
              }, 0)

              valorTotalCorreto = Number(valorCompDacao || 0) + Number(valorTransacao || 0)
            }

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

        const mesAtual = new Date(primeiroMes)

        while (mesAtual <= ultimoMes) {
          const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
          const fimMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0, 23, 59, 59)

          // 1. PARCELAS PAGAS (por data de pagamento) - TODAS as parcelas de TODOS os tipos
          const parcelasPagas = await prisma.parcela.findMany({
            where: {
              status: 'PAGO',
              dataPagamento: {
                gte: inicioMes,
                lte: fimMes
              }
            },
            select: {
              valor: true
            }
          })

          // 2. CUSTAS PAGAS (por data de pagamento) - de todos os tipos de acordo
          const [custasCompensacao, custasDacao, custasTransacao] = await Promise.all([
            prisma.acordo.findMany({
              where: {
                processo: { tipo: 'COMPENSACAO' },
                compensacao: {
                  custasAdvocaticias: { gt: 0 },
                  custasDataPagamento: {
                    gte: inicioMes,
                    lte: fimMes
                  }
                }
              },
              include: { compensacao: { select: { custasAdvocaticias: true } } }
            }),
            prisma.acordo.findMany({
              where: {
                processo: { tipo: 'DACAO_PAGAMENTO' },
                dacao: {
                  custasAdvocaticias: { gt: 0 },
                  custasDataPagamento: {
                    gte: inicioMes,
                    lte: fimMes
                  }
                }
              },
              include: { dacao: { select: { custasAdvocaticias: true } } }
            }),
            prisma.acordo.findMany({
              where: {
                processo: { tipo: 'TRANSACAO_EXCEPCIONAL' },
                transacao: {
                  custasAdvocaticias: { gt: 0 },
                  custasDataPagamento: {
                    gte: inicioMes,
                    lte: fimMes
                  }
                }
              },
              include: { transacao: { select: { custasAdvocaticias: true } } }
            })
          ])

          // 3. HONORÁRIOS PAGOS (por data de pagamento) - apenas COMPENSACAO e DACAO (Transação não tem honorariosDataPagamento)
          const [honorariosCompensacao, honorariosDacao] = await Promise.all([
            prisma.acordo.findMany({
              where: {
                processo: { tipo: 'COMPENSACAO' },
                compensacao: {
                  honorariosValor: { gt: 0 },
                  honorariosDataPagamento: {
                    gte: inicioMes,
                    lte: fimMes
                  }
                }
              },
              include: { compensacao: { select: { honorariosValor: true } } }
            }),
            prisma.acordo.findMany({
              where: {
                processo: { tipo: 'DACAO_PAGAMENTO' },
                dacao: {
                  honorariosValor: { gt: 0 },
                  honorariosDataPagamento: {
                    gte: inicioMes,
                    lte: fimMes
                  }
                }
              },
              include: { dacao: { select: { honorariosValor: true } } }
            })
          ])

          // 4. ACORDOS CUMPRIDOS (por data de assinatura) - apenas COMPENSACAO e DACAO, descontando custas/honorários
          const acordosCumpridos = await prisma.acordo.findMany({
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
            include: {
              processo: { select: { tipo: true } },
              compensacao: true,
              dacao: true
            }
          })

          // CALCULAR VALORES

          // Valor das parcelas pagas
          const valorParcelas = parcelasPagas.reduce((total, parcela) => {
            return total + Number(parcela.valor || 0)
          }, 0)

          // Valor das custas pagas
          const valorCustas = [
            ...custasCompensacao.map(a => Number(a.compensacao?.custasAdvocaticias || 0)),
            ...custasDacao.map(a => Number(a.dacao?.custasAdvocaticias || 0)),
            ...custasTransacao.map(a => Number(a.transacao?.custasAdvocaticias || 0))
          ].reduce((total, valor) => total + valor, 0)

          // Valor dos honorários pagos
          const valorHonorarios = [
            ...honorariosCompensacao.map(a => Number(a.compensacao?.honorariosValor || 0)),
            ...honorariosDacao.map(a => Number(a.dacao?.honorariosValor || 0))
          ].reduce((total, valor) => total + valor, 0)

          // Valor dos acordos cumpridos (descontando custas e honorários)
          const valorAcordos = acordosCumpridos.reduce((total, acordo) => {
            const tipoProcesso = acordo.processo?.tipo
            let valorAcordo = 0

            if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
              const valorCompensado = Number(acordo.compensacao.valorTotalDebitos || 0)
              // Não incluir custas e honorários no valor do acordo (já contados separadamente)
              valorAcordo = valorCompensado
            } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
              const valorOferecido = Number(acordo.dacao.valorTotalOferecido || 0)
              // Não incluir custas e honorários no valor do acordo (já contados separadamente)
              valorAcordo = valorOferecido
            }

            return total + valorAcordo
          }, 0)

          const valorTotal = valorParcelas + valorCustas + valorHonorarios + valorAcordos

          evolucaoMensal.push({
            mes: inicioMes.getMonth(),
            ano: inicioMes.getFullYear(),
            valor: valorTotal,
            acordos: {
              valor: valorAcordos,
              quantidade: acordosCumpridos.length
            },
            parcelas: {
              valor: valorParcelas + valorCustas + valorHonorarios,
              quantidade: parcelasPagas.length + custasCompensacao.length + custasDacao.length + custasTransacao.length + honorariosCompensacao.length + honorariosDacao.length
            },
            total: {
              valor: valorTotal,
              quantidade: acordosCumpridos.length + parcelasPagas.length + custasCompensacao.length + custasDacao.length + custasTransacao.length + honorariosCompensacao.length + honorariosDacao.length
            }
          })

          // Avançar para o próximo mês
          mesAtual.setMonth(mesAtual.getMonth() + 1)
        }


        return evolucaoMensal
      })()
    ])

    // Usar o novo valor recebido calculado (que já inclui parcelas + custas + honorários + acordos)
    const valorRecebidoTotal = Number(valorRecebidoParcelas._sum.valor || 0)

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