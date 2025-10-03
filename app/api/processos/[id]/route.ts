import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { processoSchema } from '@/lib/validations/processo'
import { SessionUser } from '@/types'
import { Decimal } from '@prisma/client/runtime/library'


interface ParcelaPrisma {
  valor: Decimal
  [key: string]: unknown
}

type TipoProcesso = 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL'
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
    const processo = await prisma.processo.findUnique({
      where: { id },
      include: {
        contribuinte: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        tramitacoes: {
          include: {
            usuario: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        documentos: {
          orderBy: { createdAt: 'desc' }
        },
        pautas: {
          include: {
            pauta: true,
            presidenteSubstituto: {
              select: {
                id: true,
                nome: true,
                email: true,
                cargo: true
              }
            }
          },
          orderBy: { pauta: { dataPauta: 'desc' } }
        },
        decisoes: {
          include: {
            sessao: {
              include: {
                pauta: true,
                presidente: {
                  select: {
                    id: true,
                    nome: true,
                    email: true,
                    cargo: true
                  }
                }
              }
            },
            votos: {
              include: {
                conselheiro: true
              },
              orderBy: { ordemApresentacao: 'asc' }
            }
          },
          orderBy: { dataDecisao: 'asc' }
        },
        acordos: {
          include: {
            parcelas: {
              include: {
                pagamentos: true
              },
              orderBy: { numero: 'asc' }
            },
            transacao: true,
            compensacao: true,
            dacao: true,
            creditos: true,
            inscricoes: {
              include: {
                debitos: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        imoveis: {
          include: {
            imovel: true
          }
        },
        creditos: {
          include: {
            credito: true
          }
        },
        inscricoes: {
          include: {
            debitos: true
          }
        },
        transacao: {
          include: {
            proposta: true
          }
        },
        acordao: true
      }
    })
    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }
    // Buscar históricos separadamente usando query raw
    let historicos: Array<{
      id: string;
      titulo: string;
      descricao: string;
      tipo: string;
      createdAt: Date;
      usuario: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
    }> = []
    try {
      const rawHistoricos = await prisma.$queryRaw<Array<{
        id: string;
        titulo: string;
        descricao: string;
        tipo: string;
        createdAt: Date;
        userId: string;
        userName: string;
        userEmail: string;
        userRole: string;
      }>>`
        SELECT
          hp.id,
          hp.titulo,
          hp.descricao,
          hp.tipo,
          hp."createdAt",
          u.id as "userId",
          u.name as "userName",
          u.email as "userEmail",
          u.role as "userRole"
        FROM "HistoricoProcesso" hp
        LEFT JOIN "User" u ON u.id = hp."usuarioId"
        WHERE hp."processoId" = ${id}
        ORDER BY hp."createdAt" DESC
      `
      historicos = rawHistoricos.map(h => ({
        id: h.id,
        titulo: h.titulo,
        descricao: h.descricao,
        tipo: h.tipo,
        createdAt: h.createdAt,
        usuario: {
          id: h.userId,
          name: h.userName,
          email: h.userEmail,
          role: h.userRole
        }
      }))
    } catch {
      historicos = []
    }
    // Os valores específicos já estão nas relações creditos e imoveis do processo
    let valoresEspecificos = null
    if (['COMPENSACAO', 'DACAO_PAGAMENTO', 'TRANSACAO_EXCEPCIONAL'].includes(processo.tipo)) {
      if (processo.tipo === 'COMPENSACAO') {
        // Para compensação, usar creditos e buscar inscrições separadamente se necessário
        valoresEspecificos = {
          creditos: processo.creditos?.map(c => ({
            ...c,
            valor: Number(c.credito?.valor || 0)
          })) || [],
          inscricoes: processo.inscricoes?.map(i => ({
            ...i,
            debitos: i.debitos?.map(d => ({
              ...d,
              valor: Number(d.valor || 0)
            })) || []
          })) || []
        }
      } else if (processo.tipo === 'DACAO_PAGAMENTO') {
        // Para dação em pagamento, mesma lógica da compensação: imóveis a ofertar + inscrições a compensar
        valoresEspecificos = {
          imoveis: processo.imoveis?.map(i => ({
            ...i,
            valorAvaliacao: Number(i.imovel?.valorAvaliado || 0)
          })) || [],
          inscricoes: processo.inscricoes?.map(i => ({
            ...i,
            debitos: i.debitos?.map(d => ({
              ...d,
              valor: Number(d.valor || 0)
            })) || []
          })) || []
        }
      } else if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
        // Para transação excepcional, buscar dados das novas tabelas
        valoresEspecificos = {
          inscricoes: processo.inscricoes?.map(i => ({
            ...i,
            debitos: i.debitos?.map(d => ({
              ...d,
              valor: Number(d.valor || 0)
            })) || []
          })) || [],
          transacao: processo.transacao ? {
            valorTotalInscricoes: Number(processo.transacao.valorTotalInscricoes),
            valorTotalProposto: Number(processo.transacao.valorTotalProposto),
            valorDesconto: Number(processo.transacao.valorDesconto),
            percentualDesconto: Number(processo.transacao.percentualDesconto),
            proposta: processo.transacao.proposta ? {
              valorTotalProposto: Number(processo.transacao.proposta.valorTotalProposto),
              metodoPagamento: processo.transacao.proposta.metodoPagamento.toLowerCase(),
              valorEntrada: Number(processo.transacao.proposta.valorEntrada),
              quantidadeParcelas: processo.transacao.proposta.quantidadeParcelas,
              valorParcela: Number(processo.transacao.proposta.valorParcela || 0)
            } : null
          } : null
        }
      }
    }
    // Converter campos Decimal para números antes de enviar para o cliente
    let acordoEnriquecido = null
    if (processo.acordos && processo.acordos[0]) {
      const acordo = processo.acordos[0]

      // Enriquecer acordo com details necessários para cálculos
      // Calcular valor total baseado no tipo de processo
      let valorTotal = 0
      if (acordo.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && acordo.transacao) {
        valorTotal = Number(acordo.transacao.valorTotalProposto || 0)
      } else if (acordo.tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
        valorTotal = Number(acordo.compensacao.valorTotalDebitos || 0)
      } else if (acordo.tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
        valorTotal = Number(acordo.dacao.valorTotalCompensar || 0)
      }

      acordoEnriquecido = {
        ...acordo,
        valorTotal: valorTotal,
        parcelas: acordo.parcelas.map((parcela: ParcelaPrisma) => ({
          ...parcela,
          valor: Number(parcela.valor)
        }))
      }

      // Adicionar transacaoDetails se for transação excepcional
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

        const custasAdvocaticias = Number(transacao.custasAdvocaticias) || 0
        const honorariosValor = Number(transacao.honorariosValor) || 0

        const acordoComDetalhes = acordoEnriquecido as typeof acordoEnriquecido & {
          transacaoDetails: {
            valorTotalInscricoes: number
            valorTotalProposto: number
            valorDesconto: number
            percentualDesconto: number
            valorEntrada: number
            custasAdvocaticias: number
            honorariosValor: number
          }
        }

        acordoComDetalhes.transacaoDetails = {
          valorTotalInscricoes: valorTotal,
          valorTotalProposto: valorProposto,
          valorDesconto: valorDesconto,
          percentualDesconto: valorTotal > 0 ? (valorDesconto / valorTotal) * 100 : 0,
          valorEntrada: valorEntrada,
          custasAdvocaticias: custasAdvocaticias,
          honorariosValor: honorariosValor
        }

        acordoEnriquecido = acordoComDetalhes
      }

      // Adicionar compensacaoDetails se for compensação
      if (acordo.tipoProcesso === 'COMPENSACAO' && acordo.compensacao) {
        const compensacao = acordo.compensacao

        const acordoComCompensacao = acordoEnriquecido as typeof acordoEnriquecido & {
          compensacaoDetails: {
            valorTotalCreditos: number
            valorTotalDebitos: number
            valorLiquido: number
            custasAdvocaticias: number
            custasDataVencimento: string | null
            custasDataPagamento: string | null
            honorariosValor: number
            honorariosMetodoPagamento: string | null
            honorariosParcelas: number | null
            honorariosDataVencimento: string | null
            honorariosDataPagamento: string | null
          }
        }

        acordoComCompensacao.compensacaoDetails = {
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

        acordoEnriquecido = acordoComCompensacao
      }

      // Adicionar dacaoDetails se for dação em pagamento
      if (acordo.tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacao) {
        const dacao = acordo.dacao

        const acordoComDacao = acordoEnriquecido as typeof acordoEnriquecido & {
          dacaoDetails: {
            valorTotalOferecido: number
            valorTotalCompensar: number
            valorLiquido: number
            custasAdvocaticias: number
            custasDataVencimento: string | null
            custasDataPagamento: string | null
            honorariosValor: number
            honorariosMetodoPagamento: string | null
            honorariosParcelas: number | null
            honorariosDataVencimento: string | null
            honorariosDataPagamento: string | null
          }
        }

        acordoComDacao.dacaoDetails = {
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

        acordoEnriquecido = acordoComDacao
      }
    }

    const processData = {
      ...processo,
      historicos,
      valoresEspecificos,
      acordo: acordoEnriquecido
    }


    return NextResponse.json({ processo: processData })
  } catch (error) {
    console.error('Erro ao buscar processo:', error)
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    const { id } = await params
    // Apenas Admin e Funcionário podem editar processos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar processos' },
        { status: 403 }
      )
    }
    const body = await request.json()
    const validationResult = processoSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }
    const { contribuinte: contribuinteData, ...processoData } = validationResult.data
    // Buscar processo atual para auditoria
    const processoAtual = await prisma.processo.findUnique({
      where: { id },
      include: { contribuinte: true }
    })
    if (!processoAtual) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se o número do processo já existe em outro processo
    if (processoData.numero !== processoAtual.numero) {
      const processoComMesmoNumero = await prisma.processo.findFirst({
        where: { 
          numero: processoData.numero,
          id: { not: id }
        }
      })
      if (processoComMesmoNumero) {
        return NextResponse.json(
          { error: 'Número de processo já existe' },
          { status: 400 }
        )
      }
    }
    // Atualizar contribuinte
    const contribuinteUpdateData = {
      ...contribuinteData
    }
    // Só incluir cpfCnpj se tiver valor
    if (contribuinteData.cpfCnpj) {
      contribuinteUpdateData.cpfCnpj = contribuinteData.cpfCnpj.replace(/\D/g, '')
    }
    await prisma.contribuinte.update({
      where: { id: processoAtual.contribuinteId },
      data: contribuinteUpdateData
    })
    // Atualizar o processo
    const processoAtualizado = await prisma.processo.update({
      where: { id },
      data: {
        ...processoData,
        tipo: processoData.tipo as TipoProcesso,
        updatedAt: new Date()
      },
      include: {
        contribuinte: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Processo',
        entidadeId: id,
        dadosAnteriores: {
          numero: processoAtual.numero,
          tipo: processoAtual.tipo,
          status: processoAtual.status,
          observacoes: processoAtual.observacoes
        },
        dadosNovos: {
          numero: processoAtualizado.numero,
          tipo: processoAtualizado.tipo,
          status: processoAtualizado.status,
          observacoes: processoAtualizado.observacoes
        }
      }
    })
    // Retornar processo atualizado
    const processoAtualizadoSerializado = {
      ...processoAtualizado
    }
    return NextResponse.json(processoAtualizadoSerializado)
  } catch (error) {
    console.error('Erro ao atualizar processo:', error)
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    const { id } = await params
    // Apenas Admin pode deletar processos
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar processos' },
        { status: 403 }
      )
    }
    const processo = await prisma.processo.findUnique({
      where: { id }
    })
    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }
    // Verificar se pode ser deletado (apenas processos em status inicial)
    if (!['RECEPCIONADO', 'EM_ANALISE'].includes(processo.status)) {
      return NextResponse.json(
        { error: 'Não é possível deletar processos que já estão em andamento' },
        { status: 400 }
      )
    }

    // Verificar se existe tramitação
    const tramitacoes = await prisma.tramitacao.count({
      where: { processoId: id }
    })
    if (tramitacoes > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui tramitações' },
        { status: 400 }
      )
    }

    // Verificar se existe documento
    const documentos = await prisma.documento.count({
      where: { processoId: id }
    })
    if (documentos > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui documentos' },
        { status: 400 }
      )
    }

    // Verificar se foi incluído em pauta
    const pautas = await prisma.processoPauta.count({
      where: { processoId: id }
    })
    if (pautas > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que foi incluído em pauta' },
        { status: 400 }
      )
    }

    // Verificar se possui decisão
    const decisoes = await prisma.decisao.count({
      where: { processoId: id }
    })
    if (decisoes > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui decisões' },
        { status: 400 }
      )
    }

    // Verificar se possui acórdão
    const acordao = await prisma.acordao.count({
      where: { processoId: id }
    })
    if (acordao > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui acórdão' },
        { status: 400 }
      )
    }

    // Verificar se possui acordos
    const acordos = await prisma.acordo.count({
      where: { processoId: id }
    })
    if (acordos > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui acordos' },
        { status: 400 }
      )
    }

    // Verificar se possui relação com imóveis
    const processoImoveis = await prisma.processoImovel.count({
      where: { processoId: id }
    })
    if (processoImoveis > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui imóveis vinculados' },
        { status: 400 }
      )
    }

    // Verificar se possui relação com créditos
    const processoCreditos = await prisma.processoCredito.count({
      where: { processoId: id }
    })
    if (processoCreditos > 0) {
      return NextResponse.json(
        { error: 'Não é possível deletar processo que possui créditos vinculados' },
        { status: 400 }
      )
    }

    await prisma.processo.delete({
      where: { id }
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Processo',
        entidadeId: id,
        dadosAnteriores: {
          numero: processo.numero,
          tipo: processo.tipo,
          status: processo.status
        }
      }
    })
    return NextResponse.json({ message: 'Processo deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}