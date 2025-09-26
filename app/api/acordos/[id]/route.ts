import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser, AcordoUpdateData } from '@/types'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: {
          include: {
            contribuinte: true,
            tramitacoes: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              include: {
                usuario: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            },
            decisoes: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        parcelas: {
          orderBy: { numero: 'asc' },
          include: {
            pagamentos: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        // Incluir dados específicos por tipo
        transacao: true,
        compensacao: true,
        dacao: true,
        creditos: true,
        inscricoes: {
          include: {
            debitos: true
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

    // Processar dados específicos da transação excepcional
    if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && acordo.transacao) {
      const transacao = acordo.transacao

      // Calcular valores baseados nos dados da transação
      const valorTotal = acordo.inscricoes.reduce((total, inscricao) => {
        return total + inscricao.debitos.reduce((subtotal, debito) => {
          return subtotal + Number(debito.valorLancado)
        }, 0)
      }, 0)

      const valorProposto = Number(transacao.valorTotalProposto)
      const valorDesconto = valorTotal - valorProposto
      const valorEntrada = Number(transacao.valorEntrada) || 0
      const quantidadeParcelas = transacao.quantidadeParcelas || 1
      const metodoPagamento = transacao.metodoPagamento

      // Adicionar campos calculados ao acordo
      const acordoEnriquecido = {
        ...acordo,
        // Campos para compatibilidade com o frontend
        valorTotal: valorTotal,
        valorFinal: valorProposto,
        valorDesconto: valorDesconto,
        valorEntrada: valorEntrada,
        modalidadePagamento: metodoPagamento,
        numeroParcelas: quantidadeParcelas,
        // Dados da transação para cálculos detalhados
        transacaoDetails: {
          valorTotalInscricoes: valorTotal,
          valorTotalProposto: valorProposto,
          desconto: valorDesconto,
          percentualDesconto: valorTotal > 0 ? (valorDesconto / valorTotal) * 100 : 0,
          entrada: valorEntrada,
          custasAdvocaticias: Number(transacao.custasAdvocaticias) || 0,
          custasDataVencimento: transacao.custasDataVencimento ? transacao.custasDataVencimento.toISOString() : null,
          custasDataPagamento: transacao.custasDataPagamento ? transacao.custasDataPagamento.toISOString() : null,
          honorariosValor: Number(transacao.honorariosValor) || 0,
          honorariosMetodoPagamento: transacao.honorariosMetodoPagamento,
          honorariosParcelas: transacao.honorariosParcelas,
          totalGeral: valorProposto + (Number(transacao.custasAdvocaticias) || 0) + (Number(transacao.honorariosValor) || 0)
        }
      }

      return NextResponse.json(acordoEnriquecido)
    }

    // Processar dados específicos de compensação
    if (acordo.tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
      const compensacao = acordo.compensacao

      const acordoEnriquecido = {
        ...acordo,
        compensacaoDetails: {
          valorTotalCreditos: Number(compensacao.valorTotalCreditos) || 0,
          valorTotalDebitos: Number(compensacao.valorTotalDebitos) || 0,
          valorLiquido: Number(compensacao.valorLiquido) || 0,
          custasAdvocaticias: Number(compensacao.custasAdvocaticias) || 0,
          custasDataVencimento: compensacao.custasDataVencimento ? compensacao.custasDataVencimento.toISOString() : null,
          custasDataPagamento: compensacao.custasDataPagamento ? compensacao.custasDataPagamento.toISOString() : null,
          honorariosValor: Number(compensacao.honorariosValor) || 0,
          honorariosMetodoPagamento: compensacao.honorariosMetodoPagamento,
          honorariosParcelas: compensacao.honorariosParcelas,
          honorariosDataVencimento: compensacao.honorariosDataVencimento ? compensacao.honorariosDataVencimento.toISOString() : null,
          honorariosDataPagamento: compensacao.honorariosDataPagamento ? compensacao.honorariosDataPagamento.toISOString() : null
        }
      }

      return NextResponse.json(acordoEnriquecido)
    }

    // Processar dados específicos de dação em pagamento
    if (acordo.tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
      const dacao = acordo.dacao

      const acordoEnriquecido = {
        ...acordo,
        dacaoDetails: {
          valorTotalOferecido: Number(dacao.valorTotalOferecido) || 0,
          valorTotalCompensar: Number(dacao.valorTotalCompensar) || 0,
          valorLiquido: Number(dacao.valorLiquido) || 0,
          custasAdvocaticias: Number(dacao.custasAdvocaticias) || 0,
          custasDataVencimento: dacao.custasDataVencimento ? dacao.custasDataVencimento.toISOString() : null,
          custasDataPagamento: dacao.custasDataPagamento ? dacao.custasDataPagamento.toISOString() : null,
          honorariosValor: Number(dacao.honorariosValor) || 0,
          honorariosMetodoPagamento: dacao.honorariosMetodoPagamento,
          honorariosParcelas: dacao.honorariosParcelas,
          honorariosDataVencimento: dacao.honorariosDataVencimento ? dacao.honorariosDataVencimento.toISOString() : null,
          honorariosDataPagamento: dacao.honorariosDataPagamento ? dacao.honorariosDataPagamento.toISOString() : null
        }
      }

      return NextResponse.json(acordoEnriquecido)
    }

    return NextResponse.json(acordo)
  } catch (error) {
    console.error('Erro ao buscar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    // Apenas Admin e Funcionário podem editar acordos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar acordos' },
        { status: 403 }
      )
    }
    const body = await request.json()
    // Buscar acordo atual
    const acordoAtual = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: true,
        parcelas: {
          include: {
            pagamentos: true
          }
        }
      }
    })
    if (!acordoAtual) {
      return NextResponse.json(
        { error: 'Acordo não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se o acordo pode ser editado
    if (acordoAtual.status === 'cancelado' || acordoAtual.status === 'cumprido') {
      return NextResponse.json(
        { error: 'Acordos cancelados ou cumpridos não podem ser editados' },
        { status: 400 }
      )
    }
    // Se há pagamentos, limitar edições (exceto cancelamento)
    const totalPagamentos = acordoAtual.parcelas.reduce((total, parcela) => {
      return total + parcela.pagamentos.length
    }, 0)
    // Permitir cancelamento e campos específicos mesmo com pagamentos
    if (totalPagamentos > 0) {
      // Com pagamentos, só permite: cancelamento, observações e motivo de cancelamento
      const camposPermitidos = ['status', 'observacoes', 'motivoCancelamento']
      const camposEnviados = Object.keys(body)
      const camposNaoPermitidos = camposEnviados.filter(campo => !camposPermitidos.includes(campo))
      if (camposNaoPermitidos.length > 0 && body.status !== 'cancelado') {
        return NextResponse.json(
          { error: 'Acordos com pagamentos registrados só podem ser cancelados ou ter observações atualizadas.' },
          { status: 400 }
        )
      }
    }
    // Preparar dados de atualização
    const updateData: AcordoUpdateData = {
      updatedAt: new Date()
    }
    // Campos que podem ser atualizados
    if (body.dataVencimento) {
      updateData.dataVencimento = new Date(body.dataVencimento)
    }
    if (body.observacoes !== undefined) {
      updateData.observacoes = body.observacoes
    }
    if (body.clausulasEspeciais !== undefined) {
      updateData.clausulasEspeciais = body.clausulasEspeciais
    }
    if (body.status && ['ativo', 'vencido', 'cancelado'].includes(body.status)) {
      updateData.status = body.status
    }
    const acordoAtualizado = await prisma.acordo.update({
      where: { id },
      data: updateData,
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        parcelas: {
          orderBy: { numero: 'asc' },
          include: {
            pagamentos: {
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    })
    // Se cancelando o acordo, atualizar status do processo
    if (body.status === 'cancelado') {
      await prisma.processo.update({
        where: { id: acordoAtual.processoId },
        data: { status: 'JULGADO' } // Volta para o status anterior
      })
      // Cancelar parcelas pendentes e atrasadas
      await prisma.parcela.updateMany({
        where: {
          acordoId: id,
          status: { in: ['PENDENTE', 'ATRASADO'] }
        },
        data: { status: 'CANCELADO' }
      })
      // Registrar no histórico do processo
      await prisma.historicoProcesso.create({
        data: {
          processoId: acordoAtual.processoId,
          usuarioId: user.id,
          titulo: 'Acordo de Pagamento Cancelado',
          descricao: `Termo ${acordoAtual.numeroTermo} foi cancelado. Motivo: ${body.motivoCancelamento || 'Não informado'}. Processo retornado ao status "Julgado".`,
          tipo: 'ACORDO'
        }
      })
    }
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Acordo',
        entidadeId: id,
        dadosAnteriores: {
          status: acordoAtual.status,
          dataVencimento: acordoAtual.dataVencimento,
          observacoes: acordoAtual.observacoes
        },
        dadosNovos: {
          status: acordoAtualizado.status,
          dataVencimento: acordoAtualizado.dataVencimento,
          observacoes: acordoAtualizado.observacoes
        }
      }
    })
    return NextResponse.json(acordoAtualizado)
  } catch (error) {
    console.error('Erro ao atualizar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    // Apenas Admin pode deletar acordos
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar acordos' },
        { status: 403 }
      )
    }
    const acordo = await prisma.acordo.findUnique({
      where: { id },
      include: {
        processo: true,
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
    // Verificar se pode ser deletado (apenas acordos sem pagamentos)
    const totalPagamentos = acordo.parcelas.reduce((total, parcela) => {
      return total + parcela.pagamentos.length
    }, 0)
    if (totalPagamentos > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar acordos que já têm pagamentos registrados' },
        { status: 400 }
      )
    }
    // Usar transação para deletar tudo de forma consistente
    await prisma.$transaction(async (tx) => {
      // Deletar pagamentos das parcelas primeiro
      await tx.pagamentoParcela.deleteMany({
        where: {
          parcela: {
            acordoId: id
          }
        }
      })

      // Deletar parcelas
      await tx.parcela.deleteMany({
        where: { acordoId: id }
      })

      // Deletar registros específicos por tipo de acordo
      await tx.acordoTransacao.deleteMany({
        where: { acordoId: id }
      })

      await tx.acordoCompensacao.deleteMany({
        where: { acordoId: id }
      })

      await tx.acordoDacao.deleteMany({
        where: { acordoId: id }
      })

      // Deletar inscrições e créditos do acordo
      await tx.acordoDebito.deleteMany({
        where: {
          inscricao: {
            acordoId: id
          }
        }
      })

      await tx.acordoInscricao.deleteMany({
        where: { acordoId: id }
      })

      await tx.acordoCredito.deleteMany({
        where: { acordoId: id }
      })

      // Finalmente deletar o acordo
      await tx.acordo.delete({
        where: { id }
      })

      // Retornar processo ao status anterior
      await tx.processo.update({
        where: { id: acordo.processoId },
        data: { status: 'JULGADO' }
      })
    })
    // Registrar no histórico do processo
    const tipoProcesso = acordo.processo.tipo
    const incluirValor = tipoProcesso !== 'COMPENSACAO'

    let descricao = `Termo ${acordo.numeroTermo} foi excluído.`
    if (incluirValor) {
      // TODO: Calcular valor baseado no tipo de acordo
      // const valorAcordo = calcularValorAcordo(acordo)
      // descricao += ` Valor: R$ ${valorAcordo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
    }
    descricao += ` Processo retornado ao status "Julgado".`

    // Definir título baseado no tipo de processo
    let tituloHistorico = 'Acordo de Transação Excepcional Excluído'
    if (tipoProcesso === 'COMPENSACAO') {
      tituloHistorico = 'Acordo de Compensação Excluído'
    } else if (tipoProcesso === 'DACAO_PAGAMENTO') {
      tituloHistorico = 'Acordo de Dação em Pagamento Excluído'
    }

    await prisma.historicoProcesso.create({
      data: {
        processoId: acordo.processoId,
        usuarioId: user.id,
        titulo: tituloHistorico,
        descricao,
        tipo: 'ACORDO'
      }
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Acordo',
        entidadeId: id,
        dadosAnteriores: {
          processoNumero: acordo.processo.numero,
          tipoProcesso: acordo.tipoProcesso,
          numeroTermo: acordo.numeroTermo,
          status: acordo.status
        }
      }
    })
    return NextResponse.json({ message: 'Acordo deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}