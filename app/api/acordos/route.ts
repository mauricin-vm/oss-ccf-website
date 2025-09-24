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

    return NextResponse.json({
      acordos,
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

    // Converter datas nos débitos das inscrições
    if (body.inscricoes) {
      body.inscricoes.forEach((inscricao: any) => {
        if (inscricao.dataVencimento) {
          const dataVenc = new Date(inscricao.dataVencimento)
          dataVenc.setHours(12, 0, 0, 0)
          inscricao.dataVencimento = dataVenc
        }
        if (inscricao.debitos) {
          inscricao.debitos.forEach((debito: any) => {
            if (debito.dataVencimento) {
              const dataVencDebito = new Date(debito.dataVencimento)
              dataVencDebito.setHours(12, 0, 0, 0)
              debito.dataVencimento = dataVencDebito
            }
          })
        }
      })
    }

    // Converter datas nos créditos
    if (body.creditos) {
      body.creditos.forEach((credito: any) => {
        if (credito.dataVencimento) {
          const dataVencCredito = new Date(credito.dataVencimento)
          dataVencCredito.setHours(12, 0, 0, 0)
          credito.dataVencimento = dataVencCredito
        }
      })
    }

    const validationResult = acordoSchema.safeParse(body)
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

    // Verificar se o processo existe e está elegível
    const processo = await prisma.processo.findUnique({
      where: { id: data.processoId },
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

    // Verificar se data de vencimento é posterior à data de assinatura
    if (data.dataVencimento <= data.dataAssinatura) {
      return NextResponse.json(
        { error: 'Data de vencimento deve ser posterior à data de assinatura' },
        { status: 400 }
      )
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

    // Criar o acordo principal usando transaction para garantir consistência
    const resultado = await prisma.$transaction(async (tx) => {
      // Criar acordo base
      const acordo = await tx.acordo.create({
        data: {
          processoId: data.processoId,
          numeroTermo,
          tipoProcesso: data.tipoProcesso,
          dataAssinatura: data.dataAssinatura,
          dataVencimento: data.dataVencimento,
          observacoes: data.observacoes,
          status: 'ativo'
        }
      })

      // Criar dados específicos por tipo de processo
      if (data.tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && 'transacao' in data) {
        await tx.acordoTransacao.create({
          data: {
            acordoId: acordo.id,
            ...data.transacao
          }
        })

        // Criar parcelas para transação
        await criarParcelasTransacao(tx, acordo.id, data.transacao)
      }

      if (data.tipoProcesso === 'COMPENSACAO' && 'compensacao' in data) {
        await tx.acordoCompensacao.create({
          data: {
            acordoId: acordo.id,
            ...data.compensacao
          }
        })

        // Criar créditos
        if ('creditos' in data) {
          for (const credito of data.creditos) {
            await tx.acordoCredito.create({
              data: {
                acordoId: acordo.id,
                ...credito
              }
            })
          }
        }
      }

      if (data.tipoProcesso === 'DACAO_PAGAMENTO' && 'dacao' in data) {
        await tx.acordoDacao.create({
          data: {
            acordoId: acordo.id,
            ...data.dacao
          }
        })
      }

      // Criar inscrições para todos os tipos
      if (data.inscricoes) {
        for (const inscricao of data.inscricoes) {
          const inscricaoCriada = await tx.acordoInscricao.create({
            data: {
              acordoId: acordo.id,
              numeroInscricao: inscricao.numeroInscricao,
              tipoInscricao: inscricao.tipoInscricao,
              finalidade: inscricao.finalidade,
              valorTotal: inscricao.valorTotal,
              descricao: inscricao.descricao,
              dataVencimento: inscricao.dataVencimento
            }
          })

          // Criar débitos da inscrição
          for (const debito of inscricao.debitos) {
            await tx.acordoDebito.create({
              data: {
                inscricaoId: inscricaoCriada.id,
                ...debito
              }
            })
          }
        }
      }

      // Atualizar status do processo para EM_CUMPRIMENTO
      await tx.processo.update({
        where: { id: data.processoId },
        data: { status: 'EM_CUMPRIMENTO' }
      })

      // Criar histórico do processo
      await tx.historicoProcesso.create({
        data: {
          processoId: data.processoId,
          usuarioId: user.id,
          titulo: 'Acordo de Pagamento Criado',
          descricao: `Acordo de pagamento criado - Termo ${numeroTermo}`,
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
            tipoProcesso: data.tipoProcesso
          }
        }
      })

      return acordo
    })

    return NextResponse.json({ id: resultado.id, numeroTermo }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Função auxiliar para criar parcelas de transação
async function criarParcelasTransacao(tx: any, acordoId: string, transacao: any) {
  if (transacao.metodoPagamento === 'parcelado' && transacao.quantidadeParcelas > 1) {
    const parcelas = []

    // Se há entrada, criar parcela de entrada
    if (transacao.valorEntrada && transacao.valorEntrada > 0) {
      parcelas.push({
        acordoId,
        tipoParcela: 'ENTRADA' as const,
        numero: 0,
        valor: transacao.valorEntrada,
        dataVencimento: new Date(), // Data atual para entrada
        status: 'PENDENTE' as const
      })
    }

    // Criar parcelas do acordo
    const valorParaParcelas = transacao.valorTotalProposto - (transacao.valorEntrada || 0)
    const valorParcela = valorParaParcelas / transacao.quantidadeParcelas

    for (let i = 1; i <= transacao.quantidadeParcelas; i++) {
      const dataVencimento = new Date()
      dataVencimento.setMonth(dataVencimento.getMonth() + i)
      dataVencimento.setHours(12, 0, 0, 0)

      parcelas.push({
        acordoId,
        tipoParcela: 'PARCELA_ACORDO' as const,
        numero: i,
        valor: valorParcela,
        dataVencimento,
        status: 'PENDENTE' as const
      })
    }

    // Criar parcelas de honorários se existirem
    if (transacao.honorariosValor && transacao.honorariosValor > 0) {
      if (transacao.honorariosMetodoPagamento === 'parcelado' && transacao.honorariosParcelas) {
        const valorParcelaHonorarios = transacao.honorariosValor / transacao.honorariosParcelas

        for (let i = 1; i <= transacao.honorariosParcelas; i++) {
          const dataVencimento = new Date()
          dataVencimento.setMonth(dataVencimento.getMonth() + i)
          dataVencimento.setHours(12, 0, 0, 0)

          parcelas.push({
            acordoId,
            tipoParcela: 'PARCELA_HONORARIOS' as const,
            numero: i,
            valor: valorParcelaHonorarios,
            dataVencimento,
            status: 'PENDENTE' as const
          })
        }
      } else {
        // Honorários à vista
        parcelas.push({
          acordoId,
          tipoParcela: 'PARCELA_HONORARIOS' as const,
          numero: 1,
          valor: transacao.honorariosValor,
          dataVencimento: new Date(),
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
  } else {
    // Pagamento à vista - criar apenas uma parcela
    await tx.parcela.create({
      data: {
        acordoId,
        tipoParcela: 'PARCELA_ACORDO',
        numero: 1,
        valor: transacao.valorTotalProposto,
        dataVencimento: new Date(),
        status: 'PENDENTE'
      }
    })
  }
}