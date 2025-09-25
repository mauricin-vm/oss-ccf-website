import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { acordoSchema } from '@/lib/validations/acordo'
import { SessionUser, AcordoWhereFilter } from '@/types'
import { TipoProcesso, StatusPagamento } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const tipo = searchParams.get('tipo')
    const modalidade = searchParams.get('modalidade')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: AcordoWhereFilter = {}

    if (search) {
      where.OR = [
        { processo: { numero: { contains: search, mode: 'insensitive' } } },
        { processo: { contribuinte: { nome: { contains: search, mode: 'insensitive' } } } },
        { numeroTermo: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (tipo) {
      where.tipoProcesso = tipo as TipoProcesso
    }

    const [acordos, total] = await Promise.all([
      prisma.acordo.findMany({
        where,
        include: {
          processo: {
            include: {
              contribuinte: true
            }
          },
          parcelas: {
            orderBy: { numero: 'asc' },
            include: {
              pagamentos: true
            }
          },
          transacao: true,
          compensacao: true,
          dacao: true,
          inscricoes: {
            include: {
              debitos: true
            }
          },
          creditos: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.acordo.count({ where })
    ])

    // Processar dados específicos da transação excepcional para cada acordo
    const acordosProcessados = acordos.map(acordo => {
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
        return {
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
      }

      return acordo
    })

    return NextResponse.json({
      acordos: acordosProcessados,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar acordos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Interfaces para dados específicos (baseado na API antiga)
interface DadosEspecificos {
  inscricoesAcordo?: any[]
  valorInscricoes?: number
  observacoesAcordo?: string
  propostaFinal?: {
    valorTotalProposto: number
    metodoPagamento: string
    valorEntrada: number
    quantidadeParcelas: number
    custasAdvocaticias?: number
    custasDataVencimento?: string
    honorariosValor?: number
    honorariosMetodoPagamento?: string
    honorariosParcelas?: number
  }
  // Para compensação
  creditosAdicionados?: any[]
  inscricoesAdicionadas?: any[]
  valorCreditos?: number
  valorDebitos?: number
  valorTotal?: number
  valorFinal?: number
  // Para dação
  inscricoesOferecidasAdicionadas?: any[]
  inscricoesCompensarAdicionadas?: any[]
  valorOferecido?: number
  valorCompensar?: number
  valorDacao?: number
  saldoFinal?: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    // Apenas Admin e Funcionário podem criar acordos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar acordos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('📥 DADOS RECEBIDOS:', JSON.stringify(body, null, 2))

    // Converter datas (ajustar timezone para evitar diferença de um dia)
    if (body.dataAssinatura) {
      const dataAssinatura = new Date(body.dataAssinatura)
      dataAssinatura.setHours(12, 0, 0, 0)
      body.dataAssinatura = dataAssinatura
    }
    if (body.dataVencimento) {
      const dataVencimento = new Date(body.dataVencimento)
      dataVencimento.setHours(12, 0, 0, 0)
      body.dataVencimento = dataVencimento
    }

    // Converter datas nos dadosEspecificos se existirem
    if (body.dadosEspecificos) {
      const dadosEsp = body.dadosEspecificos as DadosEspecificos

      // Converter datas nas inscrições de transação
      if (dadosEsp.inscricoesAcordo) {
        dadosEsp.inscricoesAcordo.forEach((inscricao: any) => {
          if (inscricao.debitos) {
            inscricao.debitos.forEach((debito: any) => {
              if (debito.dataVencimento) {
                const dataVenc = new Date(debito.dataVencimento)
                dataVenc.setHours(12, 0, 0, 0)
                debito.dataVencimento = dataVenc
              }
            })
          }
        })
      }

      // Converter datas nos créditos de compensação
      if (dadosEsp.creditosAdicionados) {
        dadosEsp.creditosAdicionados.forEach((credito: any) => {
          if (credito.dataVencimento) {
            const dataVenc = new Date(credito.dataVencimento)
            dataVenc.setHours(12, 0, 0, 0)
            credito.dataVencimento = dataVenc
          }
        })
      }

      // Converter datas nas inscrições de dação
      if (dadosEsp.inscricoesCompensarAdicionadas) {
        dadosEsp.inscricoesCompensarAdicionadas.forEach((inscricao: any) => {
          if (inscricao.debitos) {
            inscricao.debitos.forEach((debito: any) => {
              if (debito.dataVencimento) {
                const dataVenc = new Date(debito.dataVencimento)
                dataVenc.setHours(12, 0, 0, 0)
                debito.dataVencimento = dataVenc
              }
            })
          }
        })
      }
    }

    // Modificar validação para aceitar dados do formato do form
    const dataForValidation = {
      processoId: body.processoId,
      numeroTermo: body.numeroTermo,
      tipoProcesso: 'TRANSACAO_EXCEPCIONAL', // Será definido baseado no processo
      dataAssinatura: body.dataAssinatura,
      dataVencimento: body.dataVencimento,
      observacoes: body.observacoes,
      // Campos específicos serão processados depois
      inscricoes: [],
      creditos: []
    }

    // Validação mais flexível - focando apenas nos campos básicos
    if (!body.processoId) {
      return NextResponse.json(
        { error: 'Processo é obrigatório' },
        { status: 400 }
      )
    }

    if (!body.dataAssinatura) {
      return NextResponse.json(
        { error: 'Data de assinatura é obrigatória' },
        { status: 400 }
      )
    }

    if (!body.dataVencimento) {
      return NextResponse.json(
        { error: 'Data de vencimento é obrigatória' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe e está elegível
    const processo = await prisma.processo.findUnique({
      where: { id: body.processoId },
      include: {
        contribuinte: true,
        acordos: {
          orderBy: { createdAt: 'desc' }
        },
        decisoes: {
          orderBy: { dataDecisao: 'desc' },
          take: 1
        }
      }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o processo foi julgado e tem decisão favorável
    if (processo.status !== 'JULGADO' || processo.decisoes.length === 0) {
      return NextResponse.json(
        { error: 'Apenas processos julgados podem ter acordos' },
        { status: 400 }
      )
    }

    const ultimaDecisao = processo.decisoes[0]
    if (!ultimaDecisao.tipoDecisao || !['DEFERIDO', 'PARCIAL'].includes(ultimaDecisao.tipoDecisao)) {
      return NextResponse.json(
        { error: 'Apenas processos deferidos ou parcialmente deferidos podem ter acordos' },
        { status: 400 }
      )
    }

    // Verificar se já existe acordo ativo
    const acordoAtivo = processo.acordos.find(acordo => acordo.status === 'ativo')
    if (acordoAtivo) {
      return NextResponse.json(
        { error: 'Este processo já possui um acordo ativo' },
        { status: 400 }
      )
    }


    // Extrair dados específicos
    const dadosEspecificos = body.dadosEspecificos as DadosEspecificos

    // Validações específicas por tipo de processo (baseado na API antiga)
    if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
      if (!dadosEspecificos || !dadosEspecificos.valorInscricoes) {
        return NextResponse.json(
          { error: 'Dados da transação excepcional são obrigatórios' },
          { status: 400 }
        )
      }
      if (!dadosEspecificos.propostaFinal?.valorTotalProposto) {
        return NextResponse.json(
          { error: 'Valor total proposto é obrigatório' },
          { status: 400 }
        )
      }
    } else if (processo.tipo === 'COMPENSACAO') {
      if (!dadosEspecificos || !dadosEspecificos.creditosAdicionados?.length) {
        return NextResponse.json(
          { error: 'Créditos para compensação são obrigatórios' },
          { status: 400 }
        )
      }
      if (!dadosEspecificos.inscricoesAdicionadas?.length) {
        return NextResponse.json(
          { error: 'Inscrições para compensar são obrigatórias' },
          { status: 400 }
        )
      }
    } else if (processo.tipo === 'DACAO_PAGAMENTO') {
      if (!dadosEspecificos || !dadosEspecificos.inscricoesOferecidasAdicionadas?.length) {
        return NextResponse.json(
          { error: 'Inscrições oferecidas para dação são obrigatórias' },
          { status: 400 }
        )
      }
      if (!dadosEspecificos.inscricoesCompensarAdicionadas?.length) {
        return NextResponse.json(
          { error: 'Inscrições a compensar são obrigatórias' },
          { status: 400 }
        )
      }
    }

    // Gerar número do termo automaticamente
    const ano = new Date().getFullYear()
    const ultimoAcordo = await prisma.acordo.findFirst({
      where: {
        numeroTermo: {
          contains: `/${ano}`
        }
      },
      orderBy: { numeroTermo: 'desc' }
    })

    let proximoNumero = 1
    if (ultimoAcordo) {
      const ultimoNumero = parseInt(ultimoAcordo.numeroTermo.split('/')[0])
      proximoNumero = ultimoNumero + 1
    }
    const numeroTermo = `${proximoNumero.toString().padStart(4, '0')}/${ano}`

    // Calcular valores baseado no tipo de processo e dados específicos
    let valorEntrada = 0
    if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && dadosEspecificos?.propostaFinal?.valorEntrada) {
      valorEntrada = dadosEspecificos.propostaFinal.valorEntrada
    }

    // Observações do usuário vs observações técnicas
    const observacoesUsuario = body.observacoes || dadosEspecificos?.observacoesAcordo || null

    // Criar o acordo principal usando transaction para garantir consistência
    const resultado = await prisma.$transaction(async (tx) => {
      // Criar acordo base
      const acordo = await tx.acordo.create({
        data: {
          processoId: body.processoId,
          numeroTermo,
          tipoProcesso: processo.tipo as TipoProcesso,
          dataAssinatura: body.dataAssinatura,
          dataVencimento: body.dataVencimento,
          observacoes: observacoesUsuario,
          status: 'ativo'
        }
      })

      console.log('✅ ACORDO CRIADO:', acordo.id, acordo.numeroTermo)

      // Criar dados específicos por tipo de processo baseado na API antiga
      if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && dadosEspecificos) {
        await tx.acordoTransacao.create({
          data: {
            acordoId: acordo.id,
            valorTotalProposto: dadosEspecificos.propostaFinal!.valorTotalProposto,
            metodoPagamento: dadosEspecificos.propostaFinal!.metodoPagamento,
            valorEntrada: dadosEspecificos.propostaFinal!.valorEntrada || 0,
            quantidadeParcelas: dadosEspecificos.propostaFinal!.quantidadeParcelas || 1,
            valorParcela: dadosEspecificos.propostaFinal!.quantidadeParcelas > 1
              ? (dadosEspecificos.propostaFinal!.valorTotalProposto - (dadosEspecificos.propostaFinal!.valorEntrada || 0)) / dadosEspecificos.propostaFinal!.quantidadeParcelas
              : null,
            custasAdvocaticias: dadosEspecificos.propostaFinal!.custasAdvocaticias || null,
            custasDataVencimento: dadosEspecificos.propostaFinal!.custasAdvocaticias > 0
              ? (dadosEspecificos.propostaFinal!.custasDataVencimento
                 ? new Date(dadosEspecificos.propostaFinal!.custasDataVencimento + 'T12:00:00')
                 : body.dataVencimento)
              : null,
            honorariosValor: dadosEspecificos.propostaFinal!.honorariosValor || null,
            honorariosMetodoPagamento: dadosEspecificos.propostaFinal!.honorariosMetodoPagamento || null,
            honorariosParcelas: dadosEspecificos.propostaFinal!.honorariosParcelas || null,
            honorariosValorParcela: dadosEspecificos.propostaFinal!.honorariosValor && dadosEspecificos.propostaFinal!.honorariosParcelas
              ? dadosEspecificos.propostaFinal!.honorariosValor / dadosEspecificos.propostaFinal!.honorariosParcelas
              : null
          }
        })

        // Criar parcelas para transação excepcional
        await criarParcelasTransacao(tx, acordo.id, dadosEspecificos.propostaFinal!, body.dataVencimento, body.dataAssinatura)

        // Criar inscrições da transação
        if (dadosEspecificos.inscricoesAcordo) {
          for (const inscricao of dadosEspecificos.inscricoesAcordo) {
            const valorDebitos = inscricao.debitos?.reduce(
              (total: number, debito: any) => total + (Number(debito?.valor) || 0), 0
            ) || 0

            const inscricaoCriada = await tx.acordoInscricao.create({
              data: {
                acordoId: acordo.id,
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao.toUpperCase() as any,
                finalidade: 'INCLUIDA_ACORDO',
                valorTotal: valorDebitos,
                descricao: null,
                dataVencimento: null
              }
            })

            // Criar débitos da inscrição
            if (inscricao.debitos) {
              for (const debito of inscricao.debitos) {
                await tx.acordoDebito.create({
                  data: {
                    inscricaoId: inscricaoCriada.id,
                    descricao: debito.descricao,
                    valorLancado: Number(debito.valor),
                    dataVencimento: debito.dataVencimento
                  }
                })
              }
            }
          }
        }
      }

      if (processo.tipo === 'COMPENSACAO' && dadosEspecificos) {
        await tx.acordoCompensacao.create({
          data: {
            acordoId: acordo.id,
            valorTotalCreditos: dadosEspecificos.valorCreditos || 0,
            valorTotalDebitos: dadosEspecificos.valorDebitos || 0,
            valorLiquido: (dadosEspecificos.valorCreditos || 0) - (dadosEspecificos.valorDebitos || 0)
          }
        })

        // Criar créditos
        if (dadosEspecificos.creditosAdicionados) {
          for (const credito of dadosEspecificos.creditosAdicionados) {
            await tx.acordoCredito.create({
              data: {
                acordoId: acordo.id,
                tipoCredito: credito.tipo,
                numeroCredito: credito.numero,
                valor: Number(credito.valor),
                descricao: credito.descricao,
                dataVencimento: credito.dataVencimento
              }
            })
          }
        }

        // Criar inscrições a compensar
        if (dadosEspecificos.inscricoesAdicionadas) {
          for (const inscricao of dadosEspecificos.inscricoesAdicionadas) {
            const valorDebitos = inscricao.debitos?.reduce(
              (total: number, debito: any) => total + (Number(debito?.valor) || 0), 0
            ) || 0

            const inscricaoCriada = await tx.acordoInscricao.create({
              data: {
                acordoId: acordo.id,
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao.toUpperCase() as any,
                finalidade: 'INCLUIDA_ACORDO',
                valorTotal: valorDebitos,
                descricao: null,
                dataVencimento: null
              }
            })

            // Criar débitos da inscrição
            if (inscricao.debitos) {
              for (const debito of inscricao.debitos) {
                await tx.acordoDebito.create({
                  data: {
                    inscricaoId: inscricaoCriada.id,
                    descricao: debito.descricao,
                    valorLancado: Number(debito.valor),
                    dataVencimento: debito.dataVencimento
                  }
                })
              }
            }
          }
        }
      }

      if (processo.tipo === 'DACAO_PAGAMENTO' && dadosEspecificos) {
        await tx.acordoDacao.create({
          data: {
            acordoId: acordo.id,
            valorTotalOferecido: dadosEspecificos.valorOferecido || 0,
            valorTotalCompensar: dadosEspecificos.valorCompensar || 0,
            valorLiquido: (dadosEspecificos.valorOferecido || 0) - (dadosEspecificos.valorCompensar || 0)
          }
        })

        // Para dação, criar inscrições oferecidas como créditos
        if (dadosEspecificos.inscricoesOferecidasAdicionadas) {
          for (const inscricao of dadosEspecificos.inscricoesOferecidasAdicionadas) {
            await tx.acordoCredito.create({
              data: {
                acordoId: acordo.id,
                tipoCredito: 'DACAO_IMOVEL',
                numeroCredito: inscricao.numeroInscricao,
                valor: Number(inscricao.valor),
                descricao: inscricao.descricao,
                dataVencimento: inscricao.dataVencimento
              }
            })
          }
        }

        // Criar inscrições a compensar
        if (dadosEspecificos.inscricoesCompensarAdicionadas) {
          for (const inscricao of dadosEspecificos.inscricoesCompensarAdicionadas) {
            const valorDebitos = inscricao.debitos?.reduce(
              (total: number, debito: any) => total + (Number(debito?.valor) || 0), 0
            ) || 0

            const inscricaoCriada = await tx.acordoInscricao.create({
              data: {
                acordoId: acordo.id,
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao.toUpperCase() as any,
                finalidade: 'INCLUIDA_ACORDO',
                valorTotal: valorDebitos,
                descricao: null,
                dataVencimento: null
              }
            })

            // Criar débitos da inscrição
            if (inscricao.debitos) {
              for (const debito of inscricao.debitos) {
                await tx.acordoDebito.create({
                  data: {
                    inscricaoId: inscricaoCriada.id,
                    descricao: debito.descricao,
                    valorLancado: Number(debito.valor),
                    dataVencimento: debito.dataVencimento
                  }
                })
              }
            }
          }
        }
      }

      // Atualizar status do processo para EM_CUMPRIMENTO
      await tx.processo.update({
        where: { id: body.processoId },
        data: { status: 'EM_CUMPRIMENTO' }
      })

      // Definir título baseado no tipo de processo
      let tituloHistorico = 'Acordo de Pagamento Criado'
      if (processo.tipo === 'COMPENSACAO') {
        tituloHistorico = 'Acordo de Compensação Criado'
      } else if (processo.tipo === 'DACAO_PAGAMENTO') {
        tituloHistorico = 'Acordo de Dação em Pagamento Criado'
      }

      // Criar histórico do processo
      await tx.historicoProcesso.create({
        data: {
          processoId: body.processoId,
          usuarioId: user.id,
          titulo: tituloHistorico,
          descricao: `Termo ${numeroTermo} - ${getTipoProcessoLabel(processo.tipo)}`,
          tipo: 'ACORDO'
        }
      })

      // Log de auditoria
      await tx.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'CREATE',
          entidade: 'Acordo',
          entidadeId: acordo.id,
          dadosNovos: {
            processoNumero: processo.numero,
            contribuinte: processo.contribuinte.nome,
            numeroTermo,
            tipoProcesso: processo.tipo
          }
        }
      })

      return acordo
    })

    console.log('✅ ACORDO CRIADO COM SUCESSO:', resultado.id, numeroTermo)

    // Buscar acordo completo para retorno
    const acordoCompleto = await prisma.acordo.findUnique({
      where: { id: resultado.id },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        parcelas: {
          orderBy: { numero: 'asc' }
        }
      }
    })

    return NextResponse.json(acordoCompleto, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Função auxiliar para criar parcelas de transação (baseado na API antiga)
async function criarParcelasTransacao(tx: any, acordoId: string, propostaFinal: any, dataVencimento: Date, dataAssinatura: Date) {
  const parcelas = []

  if (propostaFinal.metodoPagamento === 'parcelado' && propostaFinal.quantidadeParcelas > 1) {
    const valorEntrada = propostaFinal.valorEntrada || 0
    const valorParaParcelas = propostaFinal.valorTotalProposto - valorEntrada
    const valorParcela = valorParaParcelas / propostaFinal.quantidadeParcelas

    // Se há entrada, criar uma "parcela" de entrada com vencimento na data de assinatura
    if (valorEntrada > 0) {
      const dataVencimentoEntrada = new Date(dataAssinatura)
      dataVencimentoEntrada.setHours(12, 0, 0, 0) // Ajustar timezone
      parcelas.push({
        acordoId: acordoId,
        tipoParcela: 'ENTRADA' as const,
        numero: 0, // Entrada como parcela 0
        valor: valorEntrada,
        dataVencimento: dataVencimentoEntrada,
        status: 'PENDENTE' as const
      })
    }

    for (let i = 1; i <= propostaFinal.quantidadeParcelas; i++) {
      // Usar data de vencimento como base para as parcelas
      const dataVencimentoParcela = new Date(dataVencimento)
      dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1)) // Primeira parcela vence na data de vencimento
      dataVencimentoParcela.setHours(12, 0, 0, 0) // Ajustar timezone

      parcelas.push({
        acordoId: acordoId,
        tipoParcela: 'PARCELA_ACORDO' as const,
        numero: i, // Parcelas 1, 2, 3, ..., 20
        valor: i === propostaFinal.quantidadeParcelas
          ? valorParaParcelas - (valorParcela * (propostaFinal.quantidadeParcelas - 1)) // Ajustar última parcela para compensar arredondamentos
          : valorParcela,
        dataVencimento: dataVencimentoParcela,
        status: 'PENDENTE' as const
      })
    }
  } else {
    // Criar parcela única para pagamento à vista
    const dataVencimentoAvista = new Date(dataVencimento)
    dataVencimentoAvista.setHours(12, 0, 0, 0) // Ajustar timezone
    parcelas.push({
      acordoId: acordoId,
      tipoParcela: 'PARCELA_ACORDO' as const,
      numero: 1,
      valor: propostaFinal.valorTotalProposto,
      dataVencimento: dataVencimentoAvista,
      status: 'PENDENTE' as const
    })
  }

  // Criar parcelas de honorários se existirem
  if (propostaFinal.honorariosValor && propostaFinal.honorariosValor > 0) {
    if (propostaFinal.honorariosMetodoPagamento === 'parcelado' && propostaFinal.honorariosParcelas && propostaFinal.honorariosParcelas > 1) {
      const valorParcelaHonorarios = propostaFinal.honorariosValor / propostaFinal.honorariosParcelas

      for (let i = 1; i <= propostaFinal.honorariosParcelas; i++) {
        // Usar data de vencimento do acordo como base para honorários
        const dataVencimentoHonorarios = new Date(dataVencimento)
        dataVencimentoHonorarios.setMonth(dataVencimentoHonorarios.getMonth() + i - 1) // Primeira parcela de honorário vence junto com primeira parcela do acordo
        dataVencimentoHonorarios.setHours(12, 0, 0, 0)

        parcelas.push({
          acordoId: acordoId,
          tipoParcela: 'PARCELA_HONORARIOS' as const,
          numero: i,
          valor: valorParcelaHonorarios,
          dataVencimento: dataVencimentoHonorarios,
          status: 'PENDENTE' as const
        })
      }
    } else {
      // Honorários à vista - vence na data de vencimento do acordo
      const dataVencimentoHonorariosVista = new Date(dataVencimento)
      dataVencimentoHonorariosVista.setHours(12, 0, 0, 0)

      parcelas.push({
        acordoId: acordoId,
        tipoParcela: 'PARCELA_HONORARIOS' as const,
        numero: 1,
        valor: propostaFinal.honorariosValor,
        dataVencimento: dataVencimentoHonorariosVista,
        status: 'PENDENTE' as const
      })
    }
  }

  // Criar todas as parcelas
  for (const parcela of parcelas) {
    await tx.parcela.create({
      data: parcela
    })
  }
}

// Função auxiliar para obter label do tipo de processo
function getTipoProcessoLabel(tipo: string) {
  switch (tipo) {
    case 'COMPENSACAO': return 'Compensação'
    case 'DACAO_PAGAMENTO': return 'Dação em Pagamento'
    case 'TRANSACAO_EXCEPCIONAL': return 'Transação Excepcional'
    default: return tipo
  }
}