import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { z } from 'zod'
const pagamentoSchema = z.object({
  parcelaId: z.string().min(1, 'Parcela é obrigatória'),
  dataPagamento: z.coerce.date({
    message: 'Data de pagamento é obrigatória'
  }),
  valorPago: z.number().min(0.01, 'Valor pago deve ser maior que zero'),
  formaPagamento: z.enum(['dinheiro', 'pix', 'transferencia', 'boleto', 'cartao', 'dacao', 'compensacao']).refine(val => ['dinheiro', 'pix', 'transferencia', 'boleto', 'cartao', 'dacao', 'compensacao'].includes(val), {
    message: 'Forma de pagamento é obrigatória'
  }),
  numeroComprovante: z.string().optional(),
  observacoes: z.string().optional()
})
export async function POST(request: NextRequest) {
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
    const validationResult = pagamentoSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }
    const data = validationResult.data
    // Verificar se a parcela existe e está ativa
    const parcela = await prisma.parcela.findUnique({
      where: { id: data.parcelaId },
      include: {
        acordo: {
          include: {
            processo: true
          }
        },
        pagamentos: true
      }
    })
    if (!parcela) {
      return NextResponse.json(
        { error: 'Parcela não encontrada' },
        { status: 404 }
      )
    }
    // Verificar se o acordo está ativo
    if (parcela.acordo.status !== 'ativo') {
      return NextResponse.json(
        { error: 'Não é possível registrar pagamento para acordo inativo' },
        { status: 400 }
      )
    }
    // Verificar se a parcela não está cancelada
    if (parcela.status === 'CANCELADO') {
      return NextResponse.json(
        { error: 'Não é possível registrar pagamento para parcela cancelada' },
        { status: 400 }
      )
    }
    // Calcular valor já pago
    const valorJaPago = parcela.pagamentos.reduce((total, p) => total + Number(p.valorPago || 0), 0)
    const valorRestante = Number(parcela.valor) - valorJaPago
    // Verificar se o valor não excede o restante
    if (data.valorPago > valorRestante) {
      return NextResponse.json(
        { error: `Valor pago (R$ ${data.valorPago.toFixed(2)}) excede o valor restante da parcela (R$ ${valorRestante.toFixed(2)})` },
        { status: 400 }
      )
    }
    // Usar transação para criar pagamento e atualizar status
    const result = await prisma.$transaction(async (tx) => {
      // Criar pagamento
      const pagamento = await tx.pagamentoParcela.create({
        data: {
          parcelaId: data.parcelaId,
          dataPagamento: data.dataPagamento,
          valorPago: data.valorPago,
          formaPagamento: data.formaPagamento,
          numeroComprovante: data.numeroComprovante,
          observacoes: data.observacoes
        }
      })
      // Verificar se a parcela foi totalmente paga
      const novoTotalPago = valorJaPago + data.valorPago
      const parcelaQuitada = novoTotalPago >= Number(parcela.valor)
      if (parcelaQuitada) {
        await tx.parcela.update({
          where: { id: data.parcelaId },
          data: {
            status: 'PAGO',
            dataPagamento: data.dataPagamento
          }
        })
      }
      // Verificar se todas as parcelas foram pagas para marcar acordo como cumprido
      const todasParcelas = await tx.parcela.findMany({
        where: { acordoId: parcela.acordo.id },
        include: { pagamentos: true }
      })
      const todasParcelasPagas = todasParcelas.every(p => {
        const totalPago = p.pagamentos.reduce((total, pag) => total + Number(pag.valorPago), 0)
        return totalPago >= Number(p.valor)
      })

      // Verificar se custas foram pagas (se existirem)
      let custasAdvocaticiasPagas = true
      const transacao = await tx.acordoTransacao.findUnique({
        where: { acordoId: parcela.acordo.id }
      })
      if (transacao && transacao.custasAdvocaticias && Number(transacao.custasAdvocaticias) > 0) {
        custasAdvocaticiasPagas = !!transacao.custasDataPagamento
      }

      if (todasParcelasPagas && custasAdvocaticiasPagas) {
        await tx.acordo.update({
          where: { id: parcela.acordo.id },
          data: { status: 'cumprido' }
        })
        await tx.processo.update({
          where: { id: parcela.acordo.processoId },
          data: { status: 'CONCLUIDO' }
        })
        // Registrar no histórico do processo
        await tx.historicoProcesso.create({
          data: {
            processoId: parcela.acordo.processoId,
            usuarioId: user.id,
            titulo: 'Acordo de Pagamento Cumprido',
            descricao: 'Todas as parcelas e custas foram pagas. Acordo cumprido integralmente.',
            tipo: 'ACORDO'
          }
        })
      }
      return pagamento
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Pagamento',
        entidadeId: result.id,
        dadosNovos: {
          processo: parcela.acordo.processo.numero,
          parcelaNumero: parcela.numero,
          valorPago: data.valorPago,
          formaPagamento: data.formaPagamento,
          dataPagamento: data.dataPagamento
        }
      }
    })
    return NextResponse.json({
      message: 'Pagamento registrado com sucesso',
      pagamento: result
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}