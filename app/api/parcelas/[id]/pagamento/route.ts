import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

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

    const { id: parcelaId } = await params
    const body = await request.json()

    const { valorPago, formaPagamento, observacoes, numeroComprovante } = body

    if (!valorPago || valorPago <= 0) {
      return NextResponse.json(
        { error: 'Valor pago deve ser maior que zero' },
        { status: 400 }
      )
    }

    if (!formaPagamento) {
      return NextResponse.json(
        { error: 'Forma de pagamento é obrigatória' },
        { status: 400 }
      )
    }

    // Verificar se a parcela existe e buscar informações do acordo
    const parcela = await prisma.parcela.findUnique({
      where: { id: parcelaId },
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

    // Verificar se o acordo pode receber pagamentos
    if (parcela.acordo.status === 'cancelado' || parcela.acordo.status === 'cumprido') {
      return NextResponse.json(
        { error: 'Não é possível registrar pagamentos em acordos cancelados ou cumpridos' },
        { status: 400 }
      )
    }

    // Calcular valor já pago
    const valorJaPago = parcela.pagamentos.reduce((total, pagamento) => {
      return total + Number(pagamento.valorPago)
    }, 0)

    // Verificar se o valor não excede o valor da parcela
    const valorRestante = Number(parcela.valor) - valorJaPago
    if (Number(valorPago) > valorRestante) {
      return NextResponse.json(
        { error: `Valor excede o restante da parcela. Valor restante: R$ ${valorRestante.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Usar transação para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      // Criar o pagamento
      const novoPagamento = await tx.pagamentoParcela.create({
        data: {
          parcelaId: parcelaId,
          valorPago: Number(valorPago),
          dataPagamento: new Date(),
          formaPagamento: formaPagamento,
          observacoes: observacoes || null,
          numeroComprovante: numeroComprovante || null
        }
      })

      // Calcular novo valor total pago
      const novoValorTotalPago = valorJaPago + Number(valorPago)

      // Determinar novo status da parcela
      let novoStatus = parcela.status
      if (novoValorTotalPago >= Number(parcela.valor)) {
        novoStatus = 'PAGO'
      } else if (novoValorTotalPago > 0) {
        // Se há pagamento parcial, manter status atual ou definir como PENDENTE
        if (parcela.status === 'ATRASADO' || parcela.status === 'PENDENTE') {
          novoStatus = parcela.status // Manter status atual
        } else {
          novoStatus = 'PENDENTE'
        }
      }

      // Atualizar a parcela
      const parcelaAtualizada = await tx.parcela.update({
        where: { id: parcelaId },
        data: {
          status: novoStatus,
          dataPagamento: novoStatus === 'PAGO' ? new Date() : parcela.dataPagamento
        }
      })

      // Se a parcela foi completamente paga, verificar se o acordo deve ser concluído
      if (novoStatus === 'PAGO') {
        // Buscar todas as parcelas do acordo para verificar se todas foram pagas
        const todasParcelas = await tx.parcela.findMany({
          where: { acordoId: parcela.acordo.id }
        })

        const todasParcelasPagas = todasParcelas.every(p =>
          p.id === parcelaId ? true : p.status === 'PAGO'
        )

        // Para transação excepcional, verificar se custas também foram pagas
        if (parcela.acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && todasParcelasPagas) {
          const transacao = await tx.acordoTransacao.findUnique({
            where: { acordoId: parcela.acordo.id }
          })

          const custasForamPagas = !transacao?.custasAdvocaticias ||
                                  transacao?.custasAdvocaticias <= 0 ||
                                  transacao?.custasDataPagamento

          if (custasForamPagas && parcela.acordo.status === 'ativo') {
            await tx.acordo.update({
              where: { id: parcela.acordo.id },
              data: { status: 'cumprido' }
            })

            await tx.processo.update({
              where: { id: parcela.acordo.processoId },
              data: { status: 'CONCLUIDO' }
            })

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
        }
      }

      return { novoPagamento, parcelaAtualizada }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'PagamentoParcela',
        entidadeId: result.novoPagamento.id,
        dadosNovos: {
          parcelaId: parcelaId,
          valorPago: Number(valorPago),
          formaPagamento: formaPagamento,
          dataPagamento: new Date().toISOString(),
          processoNumero: parcela.acordo.processo.numero
        }
      }
    })

    return NextResponse.json({
      message: 'Pagamento registrado com sucesso',
      pagamento: result.novoPagamento,
      parcela: result.parcelaAtualizada
    })

  } catch (error) {
    console.error('Erro ao registrar pagamento da parcela:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}