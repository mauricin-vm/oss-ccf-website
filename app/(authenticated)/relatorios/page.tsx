import { prisma } from '@/lib/db'
import { ReportsClient } from '@/components/reports/reports-client'

async function getDashboardData(filters?: { dataInicio?: Date, dataFim?: Date }) {
  // Criar filtro de período baseado nas datas - para entidades gerais (processos, pautas, sessões, parcelas)
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

  // Criar filtro específico para acordos usando dataAssinatura
  const acordoDateFilter: { dataAssinatura?: { gte?: Date; lte?: Date } } = {}
  if (filters?.dataInicio && filters?.dataFim) {
    acordoDateFilter.dataAssinatura = {
      gte: filters.dataInicio,
      lte: filters.dataFim
    }
  } else if (filters?.dataInicio) {
    acordoDateFilter.dataAssinatura = {
      gte: filters.dataInicio
    }
  } else if (filters?.dataFim) {
    acordoDateFilter.dataAssinatura = {
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
      where: acordoDateFilter
    }),

    // Total de parcelas (incluindo custas como 1 parcela adicional)
    (async () => {
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
    }).then(grupos => grupos.map(grupo => ({
      tipo: grupo.tipo,
      _count: grupo._count.id
    }))),

    // Processos por status (para pipeline)
    prisma.processo.groupBy({
      by: ['status'],
      _count: { id: true },
      where: dateFilter
    }).then(grupos => grupos.map(grupo => ({
      status: grupo.status,
      _count: grupo._count.id
    }))),

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
        ...acordoDateFilter
      }
    }),

    // Valor total calculado dos acordos de compensação e dação com nova estrutura
    (async () => {
      const acordosCompDacao = await prisma.acordo.findMany({
        where: {
          status: { in: ['ativo', 'cumprido'] },
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

      return acordosCompDacao.reduce((total, acordo) => {
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
        } else {
          valorAcordo = Number((acordo as { valorFinal?: number }).valorFinal) || 0
        }

        return total + valorAcordo
      }, 0)
    })(),

    // Valor total calculado dos acordos de transação excepcional com nova estrutura
    (async () => {
      const acordosTransacao = await prisma.acordo.findMany({
        where: {
          status: { in: ['ativo', 'cumprido'] },
          processo: {
            tipo: 'TRANSACAO_EXCEPCIONAL'
          },
          ...acordoDateFilter
        },
        include: {
          transacao: true,
          parcelas: {
            select: {
              valor: true,
              tipoParcela: true
            }
          }
        }
      })

      return acordosTransacao.reduce((total, acordo) => {
        // Usar mesma lógica da página de listagem: soma de TODAS as parcelas + custas
        const valorParcelas = acordo.parcelas.reduce((sum, parcela) => {
          return sum + Number(parcela.valor || 0)
        }, 0)

        const custasAdvocaticias = Number(acordo.transacao?.custasAdvocaticias || 0)
        const valorTotal = valorParcelas + custasAdvocaticias

        return total + valorTotal
      }, 0)
    })(),

    // Valor recebido - nova lógica: parcelas + custas + honorários pagos + acordos cumpridos sem duplicação
    (async () => {
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

    // Decisões por tipo (para gráfico de resultados)
    prisma.decisao.groupBy({
      by: ['tipoDecisao'],
      _count: { id: true },
      where: {
        tipoDecisao: { not: null },
        ...dateFilter
      }
    }).then(grupos => grupos.map(grupo => ({
      tipoDecisao: grupo.tipoDecisao,
      _count: { id: grupo._count.id }
    }))),

    // Valores por tipo de processo usando nova estrutura
    Promise.all([
      { tipo: 'COMPENSACAO' as const },
      { tipo: 'DACAO_PAGAMENTO' as const },
      { tipo: 'TRANSACAO_EXCEPCIONAL' as const }
    ].map(async ({ tipo }) => {
      const [count, acordos] = await Promise.all([
        prisma.processo.count({
          where: {
            tipo,
            ...dateFilter
          }
        }),
        prisma.acordo.findMany({
          where: {
            status: { in: ['ativo', 'cumprido'] },
            processo: { tipo },
            ...acordoDateFilter
          },
          include: {
            processo: { select: { tipo: true } },
            compensacao: tipo === 'COMPENSACAO',
            dacao: tipo === 'DACAO_PAGAMENTO',
            transacao: tipo === 'TRANSACAO_EXCEPCIONAL',
            parcelas: tipo === 'TRANSACAO_EXCEPCIONAL' ? {
              select: {
                valor: true,
                tipoParcela: true
              }
            } : false
          }
        })
      ])

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
        } else if (tipo === 'TRANSACAO_EXCEPCIONAL') {
          // Usar mesma lógica da página de listagem: soma de TODAS as parcelas + custas
          const valorParcelas = acordo.parcelas?.reduce((sum, parcela) => {
            return sum + Number(parcela.valor || 0)
          }, 0) || 0

          const custasAdvocaticias = Number(acordo.transacao?.custasAdvocaticias || 0)
          return total + valorParcelas + custasAdvocaticias
        } else {
          return total + Number((acordo as { valorFinal?: number }).valorFinal || 0)
        }
      }, 0)

      return {
        tipo,
        _count: count,
        _sum: { valorTotal }
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
          let valorTotalCorreto = 0

          // Para indeferimento, calcular baseado nos valores configurados
          if (grupo.tipoDecisao === 'INDEFERIDO') {
            // Buscar processos indeferidos e seus valores específicos
            const processosIndeferidos = await prisma.processo.findMany({
              where: {
                decisoes: {
                  some: { tipoDecisao: 'INDEFERIDO' }
                },
                ...dateFilter
              },
              select: {
                tipo: true,
                transacao: {
                  select: {
                    valorTotalProposto: true,
                    proposta: {
                      select: {
                        valorEntrada: true
                      }
                    }
                  }
                },
                acordos: {
                  select: {
                    inscricoes: {
                      select: {
                        finalidade: true,
                        valorTotal: true,
                        debitos: {
                          select: {
                            valorLancado: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            })

            valorTotalCorreto = processosIndeferidos.reduce((total, processo) => {
              let valorProcesso = 0

              if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && processo.transacao) {
                // Para transação: Valor Total Proposto (sem reduzir entrada, pois foi indeferido)
                valorProcesso = Number(processo.transacao.valorTotalProposto || 0)
              } else if (processo.tipo === 'COMPENSACAO' && processo.acordos) {
                // Para compensação: somar valores das inscrições oferecidas para compensação
                valorProcesso = processo.acordos.reduce((totalAcordos, acordo) => {
                  const inscricoesCompensacao = acordo.inscricoes?.filter(ins => ins.finalidade === 'OFERECIDA_COMPENSACAO') || []
                  return totalAcordos + inscricoesCompensacao.reduce((totalInscricoes, inscricao) => {
                    return totalInscricoes + inscricao.debitos.reduce((totalDebitos, debito) => {
                      return totalDebitos + Number(debito.valorLancado || 0)
                    }, 0)
                  }, 0)
                }, 0)
              } else if (processo.tipo === 'DACAO_PAGAMENTO' && processo.acordos) {
                // Para dação: somar valores das inscrições oferecidas como dação
                valorProcesso = processo.acordos.reduce((totalAcordos, acordo) => {
                  const inscricoesDacao = acordo.inscricoes?.filter(ins => ins.finalidade === 'OFERECIDA_DACAO') || []
                  return totalAcordos + inscricoesDacao.reduce((totalInscricoes, inscricao) => {
                    return totalInscricoes + inscricao.debitos.reduce((totalDebitos, debito) => {
                      return totalDebitos + Number(debito.valorLancado || 0)
                    }, 0)
                  }, 0)
                }, 0)
              }

              return total + valorProcesso
            }, 0)
          } else {
            // Para deferimento e parcial, usar valores dos acordos como antes
            // Buscar acordos de compensação e dação
            const acordosCompDacao = await prisma.acordo.findMany({
              where: {
                status: { in: ['ativo', 'cumprido'] },
                processo: {
                  tipo: { in: ['COMPENSACAO', 'DACAO_PAGAMENTO'] },
                  decisoes: {
                    some: { tipoDecisao: grupo.tipoDecisao }
                  }
                },
                ...acordoDateFilter
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
                status: { in: ['ativo', 'cumprido'] },
                processo: {
                  tipo: 'TRANSACAO_EXCEPCIONAL',
                  decisoes: {
                    some: { tipoDecisao: grupo.tipoDecisao }
                  }
                },
                ...acordoDateFilter
              },
              include: {
                transacao: true,
                parcelas: {
                  select: {
                    valor: true,
                    tipoParcela: true
                  }
                }
              }
            })

            const valorTransacao = acordosTransacao.reduce((total, acordo) => {
              // Usar mesma lógica da página de listagem: soma de TODAS as parcelas + custas
              const valorParcelas = acordo.parcelas?.reduce((sum, parcela) => {
                return sum + Number(parcela.valor || 0)
              }, 0) || 0

              const custasAdvocaticias = Number(acordo.transacao?.custasAdvocaticias || 0)
              return total + valorParcelas + custasAdvocaticias
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

    // Evolução mensal da arrecadação - nova lógica
    (async () => {
      const evolucaoMensal = []
      const dataAtual = new Date()

      for (let i = 11; i >= 0; i--) {
        const inicioMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() - i, 1)
        const fimMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() - i + 1, 0, 23, 59, 59)

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
      }

      return evolucaoMensal
    })()
  ])

  // Usar o novo valor recebido calculado (que já inclui parcelas + custas + honorários + acordos)
  const valorRecebidoTotal = Number(valorRecebidoParcelas._sum.valor || 0)

  // Calcular valor total correto usando nova estrutura: Acordos (Comp/Dação) + Acordos (Transação)
  const valorTotalCalculado = Number(valorAcordosCompDacao || 0) + Number(valorAcordosTransacao || 0)

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
    valoresPorTipoProcesso,
    valoresPorResultado,
    evolucaoMensal
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
      where: { dataAssinatura: { gte: dataLimite } }
    }),
    pagamentosRecentes: await prisma.parcela.count({
      where: {
        dataPagamento: { gte: dataLimite },
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