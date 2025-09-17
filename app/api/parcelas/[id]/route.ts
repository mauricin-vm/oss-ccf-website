import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { z } from 'zod'
const parcelaUpdateSchema = z.object({
  dataVencimento: z.coerce.date({
    message: 'Data de vencimento é obrigatória'
  }),
  dataPagamento: z.coerce.date().optional().nullable(),
  status: z.enum(['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO']).refine(val => ['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO'].includes(val), {
    message: 'Status é obrigatório'
  })
})
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
    // Apenas Admin e Funcionário podem editar parcelas
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar parcelas' },
        { status: 403 }
      )
    }
    const { id } = await params
    const body = await request.json()
    const validationResult = parcelaUpdateSchema.safeParse(body)
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
    // Verificar se a parcela existe
    const parcelaAtual = await prisma.parcela.findUnique({
      where: { id },
      include: {
        acordo: {
          include: {
            processo: true
          }
        }
      }
    })
    if (!parcelaAtual) {
      return NextResponse.json(
        { error: 'Parcela não encontrada' },
        { status: 404 }
      )
    }
    // Verificar se o acordo está ativo
    if (parcelaAtual.acordo.status !== 'ativo') {
      return NextResponse.json(
        { error: 'Não é possível editar parcelas de acordo inativo' },
        { status: 400 }
      )
    }
    // Validações específicas
    if (data.status === 'PAGO' && !data.dataPagamento) {
      return NextResponse.json(
        { error: 'Data de pagamento é obrigatória para parcelas pagas' },
        { status: 400 }
      )
    }
    // Usar transação para atualizar parcela e verificar status do acordo
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar parcela
      const parcelaAtualizada = await tx.parcela.update({
        where: { id },
        data: {
          dataVencimento: data.dataVencimento,
          dataPagamento: data.dataPagamento,
          status: data.status
        }
      })
      // Se a parcela foi marcada como paga, criar um pagamento automático
      if (data.status === 'PAGO' && parcelaAtual.status !== 'PAGO') {
        // Verificar se já existe pagamento para o valor total
        const pagamentosExistentes = await tx.pagamentoParcela.findMany({
          where: { parcelaId: id }
        })
        const valorJaPago = pagamentosExistentes.reduce((total, p) => total + Number(p.valorPago), 0)
        const valorRestante = Number(parcelaAtual.valor) - valorJaPago
        if (valorRestante > 0) {
          await tx.pagamentoParcela.create({
            data: {
              parcelaId: id,
              valorPago: valorRestante,
              dataPagamento: data.dataPagamento!,
              formaPagamento: 'dinheiro'
            }
          })
        }
      }
      // Verificar se todas as parcelas foram pagas para marcar acordo como cumprido
      const todasParcelas = await tx.parcela.findMany({
        where: { acordoId: parcelaAtual.acordo.id }
      })
      const todasParcelasPagas = todasParcelas.every(p => p.status === 'PAGO')
      if (todasParcelasPagas && parcelaAtual.acordo.status === 'ativo') {
        await tx.acordo.update({
          where: { id: parcelaAtual.acordo.id },
          data: { status: 'cumprido' }
        })
        await tx.processo.update({
          where: { id: parcelaAtual.acordo.processoId },
          data: { status: 'ACORDO_FIRMADO' }
        })
        // Registrar no histórico do processo
        await tx.historicoProcesso.create({
          data: {
            processoId: parcelaAtual.acordo.processoId,
            usuarioId: user.id,
            titulo: 'Acordo de Pagamento Cumprido',
            descricao: 'Todas as parcelas foram pagas. Acordo cumprido integralmente.',
            tipo: 'ACORDO'
          }
        })
      }
      return parcelaAtualizada
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Parcela',
        entidadeId: id,
        dadosAnteriores: {
          dataVencimento: parcelaAtual.dataVencimento,
          dataPagamento: parcelaAtual.dataPagamento,
          status: parcelaAtual.status
        },
        dadosNovos: {
          dataVencimento: data.dataVencimento,
          dataPagamento: data.dataPagamento,
          status: data.status,
          processo: parcelaAtual.acordo.processo.numero
        }
      }
    })
    return NextResponse.json({
      message: 'Parcela atualizada com sucesso',
      parcela: result
    })
  } catch (error) {
    console.error('Erro ao atualizar parcela:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}