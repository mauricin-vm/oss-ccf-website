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

    // Total de parcelas do acordo (excluindo honorários)
    prisma.parcela.count({
      where: {
        tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] },
        ...dateFilter
      }
    }),

    // Parcelas abertas do acordo (status PENDENTE, excluindo honorários)
    prisma.parcela.count({
      where: {
        status: 'PENDENTE',
        tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] },
        ...dateFilter
      }
    }),

    // Parcelas vencidas do acordo (excluindo honorários)
    prisma.parcela.count({
      where: {
        dataVencimento: { lt: new Date() },
        status: { not: 'PAGO' },
        tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] },
        ...dateFilter
      }
    }),

    // Parcelas pagas do acordo (excluindo honorários)
    prisma.parcela.count({
      where: {
        status: 'PAGO',
        tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] },
        ...dateFilter
      }
    }),

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

    // Acordos vencidos - mesma lógica da página de listagem
    (async () => {
      const acordosAtivos = await prisma.acordo.findMany({
        where: {
          status: 'ativo',
          ...acordoDateFilter
        },
        include: {
          parcelas: {
            where: {
              tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] }
            },
            include: {
              pagamentos: true
            }
          }
        }
      })

      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      // Contar acordos que têm pelo menos uma parcela vencida sem pagamentos
      return acordosAtivos.filter(acordo => {
        return acordo.parcelas.some(parcela => {
          // Se tem pagamentos, não está vencida (mesma lógica da listagem)
          if (parcela.pagamentos.length > 0) return false

          const vencimento = new Date(parcela.dataVencimento)
          vencimento.setHours(0, 0, 0, 0)

          return vencimento < hoje
        })
      }).length
    })(),

    // Valor calculado dos acordos de compensação e dação - SEPARADO: acordo vs custas/honorários
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

      return acordosCompDacao.reduce((totais, acordo) => {
        const tipoProcesso = acordo.processo?.tipo
        let valorAcordo = 0
        let valorCustasHonorarios = 0

        if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
          valorAcordo = Number(acordo.compensacao.valorTotalDebitos || 0) // Apenas compensado
          valorCustasHonorarios = Number(acordo.compensacao.custasAdvocaticias || 0) + Number(acordo.compensacao.honorariosValor || 0)
        } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
          valorAcordo = Number(acordo.dacao.valorTotalCompensar || 0) // Apenas compensado
          valorCustasHonorarios = Number(acordo.dacao.custasAdvocaticias || 0) + Number(acordo.dacao.honorariosValor || 0)
        } else {
          valorAcordo = Number((acordo as { valorFinal?: number }).valorFinal) || 0
        }

        return {
          valorAcordo: totais.valorAcordo + valorAcordo,
          valorCustasHonorarios: totais.valorCustasHonorarios + valorCustasHonorarios,
          valorTotal: totais.valorTotal + valorAcordo + valorCustasHonorarios
        }
      }, { valorAcordo: 0, valorCustasHonorarios: 0, valorTotal: 0 })
    })(),

    // Valor calculado dos acordos de transação excepcional - SEPARADO: acordo vs custas/honorários
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

      return acordosTransacao.reduce((totais, acordo) => {
        // Separar parcelas do acordo das parcelas de honorários
        const parcelasAcordo = acordo.parcelas.filter(p => p.tipoParcela === 'PARCELA_ACORDO' || p.tipoParcela === 'ENTRADA')
        const parcelasHonorarios = acordo.parcelas.filter(p => p.tipoParcela === 'PARCELA_HONORARIOS')

        const valorAcordo = parcelasAcordo.reduce((sum, parcela) => {
          return sum + Number(parcela.valor || 0)
        }, 0)

        const valorHonorarios = parcelasHonorarios.reduce((sum, parcela) => {
          return sum + Number(parcela.valor || 0)
        }, 0)

        const custasAdvocaticias = Number(acordo.transacao?.custasAdvocaticias || 0)
        const valorCustasHonorarios = custasAdvocaticias + valorHonorarios

        return {
          valorAcordo: totais.valorAcordo + valorAcordo,
          valorCustasHonorarios: totais.valorCustasHonorarios + valorCustasHonorarios,
          valorTotal: totais.valorTotal + valorAcordo + valorCustasHonorarios
        }
      }, { valorAcordo: 0, valorCustasHonorarios: 0, valorTotal: 0 })
    })(),

    // Valor recebido - APENAS ACORDOS (sem custas/honorários)
    (async () => {
      // 1. PARCELAS DO ACORDO PAGAS (excluindo honorários) - apenas para TRANSACAO_EXCEPCIONAL
      const parcelasAcordoPagas = await prisma.parcela.aggregate({
        where: {
          status: 'PAGO',
          tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] },
          ...dateFilter
        },
        _sum: { valor: true }
      })

      // 2. ACORDOS CUMPRIDOS (por data de assinatura) - apenas COMPENSACAO e DACAO
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

      // CALCULAR VALORES - Apenas parcelas do acordo (sem honorários) e acordos cumpridos
      const valorParcelasAcordo = Number(parcelasAcordoPagas._sum.valor || 0)

      const valorAcordosCumpridos = acordosCumpridos.reduce((total, acordo) => {
        const tipoProcesso = acordo.processo?.tipo
        let valorAcordo = 0

        if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
          // Apenas o valor compensado, sem custas e honorários
          valorAcordo = Number(acordo.compensacao.valorTotalDebitos || 0)
        } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
          // Apenas o valor compensado, sem custas e honorários
          valorAcordo = Number(acordo.dacao.valorTotalCompensar || 0)
        }

        return total + valorAcordo
      }, 0)

      const valorTotalRecebido = valorParcelasAcordo + valorAcordosCumpridos

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
          // Apenas valor compensado, sem custas/honorários
          const valorCompensado = Number(acordo.compensacao.valorTotalDebitos || 0)
          return total + valorCompensado
        } else if (tipo === 'DACAO_PAGAMENTO' && acordo.dacao) {
          // Apenas valor compensado, sem custas/honorários
          const valorCompensar = Number(acordo.dacao.valorTotalCompensar || 0)
          return total + valorCompensar
        } else if (tipo === 'TRANSACAO_EXCEPCIONAL') {
          // Apenas parcelas do acordo (excluindo honorários e custas)
          const parcelasAcordo = acordo.parcelas?.filter(p => p.tipoParcela === 'PARCELA_ACORDO' || p.tipoParcela === 'ENTRADA') || []
          const valorParcelas = parcelasAcordo.reduce((sum, parcela) => {
            return sum + Number(parcela.valor || 0)
          }, 0)
          return total + valorParcelas
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
                // Apenas valor compensado, sem custas/honorários
                valorAcordo = Number(acordo.compensacao.valorTotalDebitos || 0)
              } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
                // Apenas valor compensado, sem custas/honorários
                valorAcordo = Number(acordo.dacao.valorTotalCompensar || 0)
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
              // Apenas parcelas do acordo (excluindo honorários e custas)
              const parcelasAcordo = acordo.parcelas?.filter(p => p.tipoParcela === 'PARCELA_ACORDO' || p.tipoParcela === 'ENTRADA') || []
              const valorParcelas = parcelasAcordo.reduce((sum, parcela) => {
                return sum + Number(parcela.valor || 0)
              }, 0)
              return total + valorParcelas
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

        // 1. PARCELAS DO ACORDO PAGAS (excluindo honorários) - apenas para TRANSACAO_EXCEPCIONAL
        const parcelasAcordoPagas = await prisma.parcela.findMany({
          where: {
            status: 'PAGO',
            tipoParcela: { in: ['PARCELA_ACORDO', 'ENTRADA'] },
            dataPagamento: {
              gte: inicioMes,
              lte: fimMes
            }
          },
          select: {
            valor: true
          }
        })

        // 2. ACORDOS CUMPRIDOS (por data de assinatura) - apenas COMPENSACAO e DACAO
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

        // CALCULAR VALORES SEPARADOS POR TIPO - Apenas acordos (sem custas/honorários)

        // Valor das parcelas do acordo pagas (Transação Excepcional)
        const valorTransacao = parcelasAcordoPagas.reduce((total, parcela) => {
          return total + Number(parcela.valor || 0)
        }, 0)

        // Separar valores de acordos cumpridos por tipo
        let valorCompensacao = 0
        let valorDacao = 0
        let qtdCompensacao = 0
        let qtdDacao = 0

        acordosCumpridos.forEach(acordo => {
          const tipoProcesso = acordo.processo?.tipo
          let valorAcordo = 0

          if (tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
            // Apenas valor compensado, sem custas e honorários
            valorAcordo = Number(acordo.compensacao.valorTotalDebitos || 0)
            valorCompensacao += valorAcordo
            qtdCompensacao++
          } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
            // Apenas valor compensado, sem custas e honorários
            valorAcordo = Number(acordo.dacao.valorTotalCompensar || 0)
            valorDacao += valorAcordo
            qtdDacao++
          }
        })

        const valorTotal = valorTransacao + valorCompensacao + valorDacao

        evolucaoMensal.push({
          mes: inicioMes.getMonth(),
          ano: inicioMes.getFullYear(),
          valor: valorTotal,
          compensacao: {
            valor: valorCompensacao,
            quantidade: qtdCompensacao
          },
          dacao: {
            valor: valorDacao,
            quantidade: qtdDacao
          },
          transacao: {
            valor: valorTransacao,
            quantidade: parcelasAcordoPagas.length
          },
          total: {
            valor: valorTotal,
            quantidade: qtdCompensacao + qtdDacao + parcelasAcordoPagas.length
          }
        })
      }

      return evolucaoMensal
    })()
  ])

  // Usar o novo valor recebido calculado (que já inclui parcelas + custas + honorários + acordos)
  const valorRecebidoTotal = Number(valorRecebidoParcelas._sum.valor || 0)

  // Calcular valores separados: acordo vs custas/honorários
  const valorAcordoTotal = Number(valorAcordosCompDacao.valorAcordo || 0) + Number(valorAcordosTransacao.valorAcordo || 0)
  const valorCustasHonorariosTotal = Number(valorAcordosCompDacao.valorCustasHonorarios || 0) + Number(valorAcordosTransacao.valorCustasHonorarios || 0)
  const valorTotalCalculado = Number(valorAcordosCompDacao.valorTotal || 0) + Number(valorAcordosTransacao.valorTotal || 0)

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
      acordos: Number(valorAcordoTotal),
      custasHonorarios: Number(valorCustasHonorariosTotal),
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