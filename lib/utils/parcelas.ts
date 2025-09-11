import { prisma } from '@/lib/db'

export interface ParcelaStatus {
  id: string
  numero: number
  valor: number
  dataVencimento: Date
  status: 'pendente' | 'paga' | 'vencida' | 'cancelada'
  valorPago: number
  valorRestante: number
  diasVencimento?: number
}

export interface AcordoStatus {
  id: string
  status: 'ativo' | 'cumprido' | 'vencido' | 'cancelado'
  valorTotal: number
  valorPago: number
  valorRestante: number
  percentualPago: number
  parcelasTotal: number
  parcelasPagas: number
  parcelasPendentes: number
  parcelasVencidas: number
}

/**
 * Atualiza o status das parcelas baseado na data atual
 */
export async function atualizarStatusParcelas() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  try {
    // Buscar parcelas pendentes que venceram
    const parcelasVencidas = await prisma.parcelaAcordo.findMany({
      where: {
        status: 'pendente',
        dataVencimento: {
          lt: hoje
        },
        acordo: {
          status: 'ativo'
        }
      }
    })

    // Atualizar status para vencida
    if (parcelasVencidas.length > 0) {
      await prisma.parcelaAcordo.updateMany({
        where: {
          id: {
            in: parcelasVencidas.map(p => p.id)
          }
        },
        data: {
          status: 'vencida'
        }
      })
    }

    // Buscar acordos que têm parcelas vencidas
    const acordosComParcelasVencidas = await prisma.acordo.findMany({
      where: {
        status: 'ativo',
        parcelas: {
          some: {
            status: 'vencida'
          }
        }
      },
      include: {
        parcelas: true
      }
    })

    // Atualizar status dos acordos para vencido se tiverem parcelas vencidas
    for (const acordo of acordosComParcelasVencidas) {
      const temParcelasVencidas = acordo.parcelas.some(p => p.status === 'vencida')
      
      if (temParcelasVencidas && acordo.status === 'ativo') {
        await prisma.acordo.update({
          where: { id: acordo.id },
          data: { status: 'vencido' }
        })
      }
    }

    return {
      parcelasAtualizadas: parcelasVencidas.length,
      acordosAtualizados: acordosComParcelasVencidas.length
    }
  } catch (error) {
    console.error('Erro ao atualizar status das parcelas:', error)
    throw error
  }
}

interface ParcelaInput {
  id: string
  numero: number
  valor: number
  dataVencimento: Date
  status: string
  valorPago?: number
  pagamentos?: { valorPago: number }[]
}

/**
 * Calcula o status detalhado de uma parcela
 */
export function calcularStatusParcela(parcela: ParcelaInput): ParcelaStatus {
  const hoje = new Date()
  const dataVencimento = new Date(parcela.dataVencimento)
  const valorPago = parcela.pagamentos?.reduce((total: number, p) => total + p.valorPago, 0) || parcela.valorPago || 0
  const valorRestante = parcela.valor - valorPago
  
  let status: ParcelaStatus['status'] = parcela.status
  
  // Atualizar status baseado na data e pagamentos
  if (valorPago >= parcela.valor) {
    status = 'paga'
  } else if (dataVencimento < hoje && status === 'pendente') {
    status = 'vencida'
  }

  const diasVencimento = Math.floor((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24))

  return {
    id: parcela.id,
    numero: parcela.numero,
    valor: parcela.valor,
    dataVencimento,
    status,
    valorPago,
    valorRestante,
    diasVencimento: diasVencimento > 0 ? diasVencimento : undefined
  }
}

interface AcordoInput {
  id: string
  status: string
  valorFinal?: number
  parcelas?: ParcelaInput[]
  pagamentos?: { valorPago: number }[]
}

/**
 * Calcula o status detalhado de um acordo
 */
export function calcularStatusAcordo(acordo: AcordoInput): AcordoStatus {
  const parcelas = acordo.parcelas || []
  const pagamentos = acordo.pagamentos || []
  
  const valorTotal = acordo.valorFinal || 0
  const valorPago = pagamentos.reduce((total: number, p) => total + p.valorPago, 0)
  const valorRestante = valorTotal - valorPago
  const percentualPago = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0
  
  const parcelasComStatus = parcelas.map((p) => calcularStatusParcela(p))
  const parcelasTotal = parcelas.length
  const parcelasPagas = parcelasComStatus.filter(p => p.status === 'paga').length
  const parcelasPendentes = parcelasComStatus.filter(p => p.status === 'pendente').length
  const parcelasVencidas = parcelasComStatus.filter(p => p.status === 'vencida').length
  
  let status: AcordoStatus['status'] = acordo.status
  
  // Atualizar status baseado no estado das parcelas
  if (parcelasPagas === parcelasTotal && valorRestante <= 0) {
    status = 'cumprido'
  } else if (parcelasVencidas > 0 && status === 'ativo') {
    status = 'vencido'
  }

  return {
    id: acordo.id,
    status,
    valorTotal,
    valorPago,
    valorRestante,
    percentualPago,
    parcelasTotal,
    parcelasPagas,
    parcelasPendentes,
    parcelasVencidas
  }
}

/**
 * Agenda a próxima parcela para vencimento
 */
export async function agendarProximaParcela(acordoId: string) {
  try {
    const acordo = await prisma.acordo.findUnique({
      where: { id: acordoId },
      include: {
        parcelas: {
          orderBy: { numero: 'asc' }
        }
      }
    })

    if (!acordo) {
      throw new Error('Acordo não encontrado')
    }

    const proximaParcela = acordo.parcelas.find(p => p.status === 'pendente')
    
    if (proximaParcela) {
      const hoje = new Date()
      const dataVencimento = new Date(proximaParcela.dataVencimento)
      
      if (dataVencimento <= hoje) {
        // Atualizar para vencida se já passou da data
        await prisma.parcelaAcordo.update({
          where: { id: proximaParcela.id },
          data: { status: 'vencida' }
        })
        
        // Atualizar acordo para vencido se necessário
        await prisma.acordo.update({
          where: { id: acordoId },
          data: { status: 'vencido' }
        })
      }
    }

    return proximaParcela
  } catch (error) {
    console.error('Erro ao agendar próxima parcela:', error)
    throw error
  }
}

/**
 * Gera relatório de parcelas vencidas
 */
export async function gerarRelatorioParcelasVencidas(diasVencimento: number = 0) {
  try {
    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - diasVencimento)
    dataLimite.setHours(0, 0, 0, 0)

    const parcelasVencidas = await prisma.parcelaAcordo.findMany({
      where: {
        status: 'vencida',
        dataVencimento: {
          lte: dataLimite
        }
      },
      include: {
        acordo: {
          include: {
            processo: {
              include: {
                contribuinte: true
              }
            }
          }
        },
        pagamentos: true
      },
      orderBy: {
        dataVencimento: 'asc'
      }
    })

    return parcelasVencidas.map(parcela => {
      const diasVencido = Math.floor((new Date().getTime() - new Date(parcela.dataVencimento).getTime()) / (1000 * 60 * 60 * 24))
      const valorPago = parcela.pagamentos.reduce((total, p) => total + p.valorPago, 0)
      const valorRestante = parcela.valor - valorPago

      return {
        parcelaId: parcela.id,
        acordoId: parcela.acordoId,
        processoNumero: parcela.acordo.processo.numero,
        contribuinte: parcela.acordo.processo.contribuinte.nome,
        documento: parcela.acordo.processo.contribuinte.documento,
        numeroParcela: parcela.numero,
        valorParcela: parcela.valor,
        valorPago,
        valorRestante,
        dataVencimento: parcela.dataVencimento,
        diasVencido,
        acordo: {
          valorTotal: parcela.acordo.valorFinal,
          modalidade: parcela.acordo.modalidadePagamento,
          status: parcela.acordo.status
        }
      }
    })
  } catch (error) {
    console.error('Erro ao gerar relatório de parcelas vencidas:', error)
    throw error
  }
}

/**
 * Calcula multa e juros por atraso (se aplicável)
 */
export function calcularMultaJuros(valorParcela: number, diasAtraso: number, taxaJurosDia: number = 0.033, multa: number = 0.02) {
  if (diasAtraso <= 0) {
    return { valorMulta: 0, valorJuros: 0, valorTotal: valorParcela }
  }

  const valorMulta = valorParcela * multa // 2% de multa
  const valorJuros = valorParcela * (taxaJurosDia / 100) * diasAtraso // Juros por dia de atraso
  const valorTotal = valorParcela + valorMulta + valorJuros

  return {
    valorMulta,
    valorJuros,
    valorTotal,
    diasAtraso
  }
}