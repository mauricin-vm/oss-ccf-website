import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { pagamentoSchema } from '@/lib/validations/acordo'
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

    const pagamentos = await prisma.pagamentoAcordo.findMany({
      where: { 
        parcela: { 
          acordoId: id 
        } 
      },
      include: {
        parcela: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ pagamentos })
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin e Funcionário podem registrar pagamentos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para registrar pagamentos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Converter data
    if (body.dataPagamento) {
      body.dataPagamento = new Date(body.dataPagamento)
    }

    const validationResult = pagamentoSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const { id } = await params

    // Verificar se o acordo existe e está ativo
    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        parcelas: {
          include: {
            pagamentos: true
          }
        }
      }
    })

    if (!acordo) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }

    if (acordo.status !== 'ativo') {
      return NextResponse.json(
        { error: 'Apenas acordos ativos podem receber pagamentos' },
        { status: 400 }
      )
    }

    // Verificar se a parcela existe e pertence ao acordo
    const parcela = acordo.parcelas.find(p => p.id === data.parcelaId)

    if (!parcela) {
      return NextResponse.json(
        { error: 'Parcela não encontrada neste acordo' },
        { status: 404 }
      )
    }

    if (parcela.status !== 'pendente') {
      return NextResponse.json(
        { error: 'Esta parcela não está pendente de pagamento' },
        { status: 400 }
      )
    }

    // Calcular valor já pago da parcela
    const valorJaPago = parcela.pagamentos.reduce((total, p) => total + p.valorPago, 0)
    const valorRestante = parcela.valor - valorJaPago

    if (data.valorPago > valorRestante) {
      return NextResponse.json(
        { error: `Valor excede o saldo restante da parcela (R$ ${valorRestante.toFixed(2)})` },
        { status: 400 }
      )
    }

    // Verificar se a data do pagamento não é futura
    if (data.dataPagamento > new Date()) {
      return NextResponse.json(
        { error: 'Data do pagamento não pode ser futura' },
        { status: 400 }
      )
    }

    // Criar o pagamento
    const pagamento = await prisma.pagamentoAcordo.create({
      data: {
        parcelaId: data.parcelaId,
        dataPagamento: data.dataPagamento,
        valorPago: data.valorPago,
        formaPagamento: data.formaPagamento,
        numeroComprovante: data.numeroComprovante,
        observacoes: data.observacoes
      },
      include: {
        parcela: true
      }
    })

    // Verificar se a parcela foi quitada
    const novoValorPago = valorJaPago + data.valorPago
    const parcelaQuitada = novoValorPago >= parcela.valor

    if (parcelaQuitada) {
      // Atualizar status da parcela para 'paga' e definir data de pagamento
      await prisma.parcelaAcordo.update({
        where: { id: data.parcelaId },
        data: {
          status: 'paga',
          dataPagamento: data.dataPagamento,
          valorPago: novoValorPago
        }
      })
    } else {
      // Atualizar apenas o valor pago
      await prisma.parcelaAcordo.update({
        where: { id: data.parcelaId },
        data: {
          valorPago: novoValorPago
        }
      })
    }

    // Verificar se todas as parcelas foram pagas para marcar acordo como cumprido
    const todasParcelasPagas = await prisma.parcelaAcordo.findMany({
      where: { 
        acordoId: id,
        status: 'pendente'
      }
    })

    const parcelasRestantes = todasParcelasPagas.filter(p => {
      if (p.id === data.parcelaId) {
        return !parcelaQuitada // Se esta parcela foi quitada, não conta como restante
      }
      return true
    })

    if (parcelasRestantes.length === 0) {
      // Todas as parcelas foram pagas, marcar acordo como cumprido
      await prisma.acordo.update({
        where: { id },
        data: { 
          status: 'cumprido'
        }
      })

      // Atualizar status do processo
      await prisma.processo.update({
        where: { id: acordo.processoId },
        data: { status: 'ARQUIVADO' }
      })
    }

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'PagamentoAcordo',
        entidadeId: pagamento.id,
        dadosNovos: {
          acordoId: id,
          processoNumero: acordo.processo.numero,
          contribuinte: acordo.processo.contribuinte.nome,
          parcelaNumerо: parcela.numero,
          valorPago: data.valorPago,
          formaPagamento: data.formaPagamento,
          dataPagamento: data.dataPagamento,
          parcelaQuitada,
          numeroComprovante: data.numeroComprovante
        }
      }
    })

    // Buscar pagamento completo para retorno
    const pagamentoCompleto = await prisma.pagamentoAcordo.findUnique({
      where: { id: pagamento.id },
      include: {
        parcela: {
          include: {
            acordo: {
              include: {
                processo: {
                  include: {
                    contribuinte: true
                  }
                }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(pagamentoCompleto, { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}