import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { acordoSchema } from '@/lib/validations/acordo'
import { SessionUser, AcordoWhereFilter } from '@/types'
import { StatusPagamento } from '@prisma/client'

// Interfaces para dados das APIs
interface InscricaoAcordo {
  numeroInscricao: string
  tipoInscricao: string
  valorAbatido?: number
  situacao?: string
  debitos?: DebitoAcordo[]
}

interface DebitoAcordo {
  descricao: string
  valor: number
  dataVencimento: string
}

interface CreditoCompensacao {
  tipo: string
  numero: string
  valor: number
  dataVencimento?: string
  descricao?: string
}


interface InscricaoOferecida {
  numeroInscricao: string
  tipoInscricao: string
  valor: number
  dataVencimento?: string
  descricao?: string
}

interface InscricaoCompensar {
  numeroInscricao: string
  tipoInscricao: string
  debitos: DebitoAcordo[]
}

interface DadosEspecificos {
  inscricoesAcordo?: InscricaoAcordo[]
  inscricoesSelecionadas?: (InscricaoAcordo | string)[]
  valorInscricoes?: number
  observacoesAcordo?: string
  creditos?: CreditoCompensacao[]
  inscricoes?: InscricaoAcordo[]
  inscricoesOferecidas?: InscricaoOferecida[] | string[]
  inscricoesCompensar?: InscricaoCompensar[] | string[]
  creditosSelecionados?: CreditoCompensacao[] | string[]
  valorCreditos?: number
  valorDebitos?: number
  valorCompensacao?: number
  valorCompensar?: number
  valorDacao?: number
  // Propriedades específicas para dação em pagamento
  inscricoesOferecidasAdicionadas?: InscricaoOferecida[]
  inscricoesCompensarAdicionadas?: InscricaoCompensar[]
  valorOferecido?: number
  saldoFinal?: number
  // Propriedades específicas para compensação
  creditosAdicionados?: CreditoCompensacao[]
  inscricoesAdicionadas?: InscricaoCompensar[]
  // Propriedades para cálculos gerais
  valorTotal?: number
  valorFinal?: number
}
async function criarDetalhesEspecificos(acordoId: string, tipoProcesso: string, dadosEspecificos: DadosEspecificos) {
  switch (tipoProcesso) {
    case 'TRANSACAO_EXCEPCIONAL':
      // Verificar se tem dados de inscrições (novo formato) ou formato antigo
      const inscricoesData = dadosEspecificos.inscricoesAcordo || dadosEspecificos.inscricoesSelecionadas
      if (inscricoesData && inscricoesData.length > 0) {
        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'transacao',
            descricao: 'Transação Excepcional - Acordo Final',
            valorOriginal: dadosEspecificos.valorInscricoes || 0,
            valorNegociado: dadosEspecificos.valorInscricoes || 0,
            status: StatusPagamento.PENDENTE,
            observacoes: dadosEspecificos.observacoesAcordo || null
          }
        })
        // Criar registros detalhados das inscrições
        for (const inscricao of inscricoesData) {
          // Verificar se inscricao é um objeto (não string)
          if (typeof inscricao === 'string') continue

          // Calcular valor total dos débitos para esta inscrição
          const valorDebitos = inscricao.debitos?.reduce(
            (total: number, debito: DebitoAcordo) => total + (Number(debito?.valor) || 0), 0
          ) || 0
          // Preparar lista de débitos para salvar no JSON
          const debitosDetalhados = inscricao.debitos?.map((debito: DebitoAcordo) => ({
            descricao: debito.descricao,
            valor: Number(debito.valor),
            dataVencimento: debito.dataVencimento
          })) || []
          await prisma.acordoInscricao.create({
            data: {
              acordoDetalheId: detalhe.id,
              numeroInscricao: inscricao.numeroInscricao,
              tipoInscricao: inscricao.tipoInscricao,
              valorDebito: valorDebitos,
              valorAbatido: valorDebitos,
              percentualAbatido: 100,
              situacao: 'pendente',
              descricaoDebitos: JSON.stringify(debitosDetalhados)
            }
          })
        }
      }
      break
    case 'COMPENSACAO':
      // Usar os nomes corretos enviados pelo CompensacaoSection
      const creditos = dadosEspecificos.creditosAdicionados || dadosEspecificos.creditosSelecionados || []
      const inscricoes = dadosEspecificos.inscricoesAdicionadas || dadosEspecificos.inscricoesSelecionadas || []

      if (creditos.length > 0 || inscricoes.length > 0) {

        const creditosData = creditos.length > 0 ? {
          creditosOferecidos: creditos,
          valorTotalCreditos: dadosEspecificos.valorCreditos || 0
        } : null


        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'compensacao',
            descricao: 'Compensação de Créditos e Débitos',
            valorOriginal: Math.max(dadosEspecificos.valorCreditos || 0, dadosEspecificos.valorDebitos || 0),
            valorNegociado: Math.max(dadosEspecificos.valorCreditos || 0, dadosEspecificos.valorDebitos || 0),
            status: StatusPagamento.PENDENTE,
            // Salvar créditos como JSON no campo observacoes
            observacoes: creditosData ? JSON.stringify(creditosData) : null
          }
        })

        // Criar registros para cada inscrição a compensar
        if (inscricoes.length > 0) {
          for (const inscricaoItem of inscricoes) {
            // Verificar se é um objeto inscrição válido
            if (typeof inscricaoItem === 'string') continue

            const inscricao = inscricaoItem as InscricaoCompensar

            // Calcular valor total dos débitos para esta inscrição
            const valorDebitos = inscricao.debitos?.reduce(
              (total: number, debito: DebitoAcordo) => total + (Number(debito?.valor) || 0), 0
            ) || 0

            // Preparar lista de débitos para salvar no JSON
            const debitosDetalhados = inscricao.debitos?.map((debito: DebitoAcordo) => ({
              descricao: debito.descricao,
              valor: Number(debito.valor),
              dataVencimento: debito.dataVencimento
            })) || []

            await prisma.acordoInscricao.create({
              data: {
                acordoDetalheId: detalhe.id,
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao,
                valorDebito: valorDebitos,
                valorAbatido: valorDebitos, // Para compensação, o valor é totalmente abatido
                percentualAbatido: 100,
                situacao: 'pendente',
                descricaoDebitos: JSON.stringify(debitosDetalhados)
              }
            })
          }
        }
      }
      break
    case 'DACAO_PAGAMENTO':
      // Usar os nomes corretos enviados pelo DacaoSection
      const inscricoesOferecidasAdicionadas = dadosEspecificos.inscricoesOferecidasAdicionadas || []
      const inscricoesCompensarAdicionadas = dadosEspecificos.inscricoesCompensarAdicionadas || []

      // Criar AcordoDetalhes sempre (seguindo padrão da compensação)
      if (inscricoesOferecidasAdicionadas.length > 0 || inscricoesCompensarAdicionadas.length > 0) {
        // Para dação, salvar dados seguindo o padrão da compensação:
        // - "Inscrições oferecidas" nas observações (similar aos créditos)
        // - "Inscrições a compensar" na tabela acordoInscricao (similar às inscrições incluídas)
        const dadosTecnicos = {
          inscricoesOferecidas: inscricoesOferecidasAdicionadas,
          valorTotalOferecido: dadosEspecificos.valorOferecido || 0,
          valorCompensar: dadosEspecificos.valorCompensar || 0,
          valorDacao: dadosEspecificos.valorDacao || 0,
          saldoFinal: dadosEspecificos.saldoFinal || 0
        }

        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'dacao',
            descricao: 'Dação em Pagamento',
            valorOriginal: dadosEspecificos.valorOferecido || 0,
            valorNegociado: dadosEspecificos.valorOferecido || 0,
            observacoes: JSON.stringify(dadosTecnicos),
            status: StatusPagamento.PENDENTE
          }
        })

        // Criar registros para inscrições a compensar
        if (inscricoesCompensarAdicionadas.length > 0) {
          for (const inscricao of inscricoesCompensarAdicionadas) {
            // Calcular valor total dos débitos para esta inscrição
            const valorDebitos = inscricao.debitos?.reduce(
              (total: number, debito: DebitoAcordo) => total + (Number(debito?.valor) || 0), 0
            ) || 0

            // Preparar lista de débitos para salvar no JSON
            const debitosDetalhados = inscricao.debitos?.map((debito: DebitoAcordo) => ({
              descricao: debito.descricao,
              valor: Number(debito.valor),
              dataVencimento: debito.dataVencimento
            })) || []

            await prisma.acordoInscricao.create({
              data: {
                acordoDetalheId: detalhe.id,
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao,
                valorDebito: valorDebitos,
                valorAbatido: valorDebitos, // Para dação, o valor é totalmente abatido
                percentualAbatido: 100,
                situacao: 'pendente',
                descricaoDebitos: JSON.stringify(debitosDetalhados)
              }
            })
          }
        }

      }
      break
  }
}
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const ano = searchParams.get('ano')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const where: AcordoWhereFilter = {}
    if (search) {
      where.OR = [
        { processo: { numero: { contains: search, mode: 'insensitive' } } },
        { processo: { contribuinte: { nome: { contains: search, mode: 'insensitive' } } } }
      ]
    }
    if (status) {
      where.status = status
    }
    if (ano) {
      const startDate = new Date(`${ano}-01-01`)
      const endDate = new Date(`${ano}-12-31`)
      where.dataAssinatura = {
        gte: startDate,
        lte: endDate
      }
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
          detalhes: {
            include: {
              imovel: true,
              credito: true,
              inscricoes: true
            }
          }
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

    // Log do body EXATO recebido

    // Converter datas (ajustar timezone para evitar diferença de um dia)
    // Converter datas (ajustar timezone para evitar diferença de um dia)
    if (body.dataAssinatura) {
      try {
        const dataAssinatura = new Date(body.dataAssinatura)
        dataAssinatura.setHours(12, 0, 0, 0) // Meio-dia para evitar problemas de timezone
        body.dataAssinatura = dataAssinatura
      } catch (error) {
        throw error
      }
    }
    if (body.dataVencimento) {
      try {
        const dataVencimento = new Date(body.dataVencimento)
        dataVencimento.setHours(12, 0, 0, 0) // Meio-dia para evitar problemas de timezone
        body.dataVencimento = dataVencimento
      } catch (error) {
        throw error
      }
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
    // Se existe acordo cancelado, permitir novo acordo
    const acordoCancelado = processo.acordos.find(acordo => acordo.status === 'cancelado')
    if (acordoCancelado) {
      // Processo tem acordo cancelado, permitindo criação de novo acordo
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
    // Calcular valores corretos para o acordo
    let valorOriginal = data.valorTotal
    let valorDesconto = data.valorDesconto || 0
    let percentualDesconto = data.percentualDesconto || 0
    // Para transação excepcional, usar valor das inscrições como valor original (valor fixo no momento da criação)
    if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && data.dadosEspecificos?.valorInscricoes) {
      // IMPORTANTE: Este valor é "congelado" no momento da criação do acordo
      // para manter a integridade histórica, mesmo se as inscrições forem alteradas depois
      valorOriginal = data.dadosEspecificos.valorInscricoes
      valorDesconto = valorOriginal - data.valorFinal
      percentualDesconto = valorOriginal > 0 ? (valorDesconto / valorOriginal) * 100 : 0
    }

    // Para compensação, usar valor dos créditos como valor original
    if (processo.tipo === 'COMPENSACAO' && data.dadosEspecificos?.valorCreditos) {
      valorOriginal = data.dadosEspecificos.valorCreditos
    }

    // Para dação em pagamento, usar valor das inscrições oferecidas como valor original
    if (processo.tipo === 'DACAO_PAGAMENTO' && data.dadosEspecificos?.valorOferecido) {
      valorOriginal = data.dadosEspecificos.valorOferecido
    }
    // Definir valor de entrada
    let valorEntrada = 0
    if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && data.dadosEspecificos?.propostaFinal?.valorEntrada) {
      valorEntrada = data.dadosEspecificos.propostaFinal.valorEntrada
    }
    // Separar observações do usuário das observações técnicas
    // Observações do usuário vão para a tabela Acordo
    const observacoesUsuario = data.observacoes || data.dadosEspecificos?.observacoesAcordo || null

    // Criar o acordo
    const acordo = await prisma.acordo.create({
      data: {
        processoId: data.processoId,
        numeroTermo,
        valorTotal: valorOriginal, // valorTotal representa o valor original/base
        valorDesconto: valorDesconto,
        percentualDesconto: percentualDesconto,
        valorFinal: data.valorFinal,
        valorEntrada: valorEntrada > 0 ? valorEntrada : null,
        dataAssinatura: data.dataAssinatura,
        dataVencimento: data.dataVencimento,
        modalidadePagamento: data.modalidadePagamento,
        numeroParcelas: data.numeroParcelas || 1,
        observacoes: observacoesUsuario,
        clausulasEspeciais: data.clausulasEspeciais,
        status: 'ativo'
      },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        }
      }
    })
    // Criar detalhes específicos do acordo baseado no tipo de processo
    if (data.dadosEspecificos && processo.tipo) {
      await criarDetalhesEspecificos(acordo.id, processo.tipo, data.dadosEspecificos)
    }
    // Gerar parcelas apenas para TRANSACAO_EXCEPCIONAL (compensação e dação não têm parcelas)
    if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
      if (data.modalidadePagamento === 'parcelado' && data.numeroParcelas && data.numeroParcelas > 1) {
        // Usar o valor de entrada já definido anteriormente
        const valorParaParcelas = data.valorFinal - valorEntrada
        const valorParcela = valorParaParcelas / data.numeroParcelas
        const parcelas = []
        // Se há entrada, criar uma "parcela" de entrada com vencimento na data de assinatura
        if (valorEntrada > 0) {
          const dataVencimentoEntrada = new Date(data.dataAssinatura)
          dataVencimentoEntrada.setHours(12, 0, 0, 0) // Ajustar timezone
          parcelas.push({
            acordoId: acordo.id,
            numero: 0, // Entrada como parcela 0
            valor: valorEntrada,
            dataVencimento: dataVencimentoEntrada,
            status: StatusPagamento.PENDENTE
          })
        }
        for (let i = 1; i <= data.numeroParcelas; i++) {
          // Usar data de vencimento como base para as parcelas
          const dataVencimentoParcela = new Date(data.dataVencimento)
          dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1)) // Primeira parcela vence na data de vencimento
          dataVencimentoParcela.setHours(12, 0, 0, 0) // Ajustar timezone
          parcelas.push({
            acordoId: acordo.id,
            numero: i, // Parcelas 1, 2, 3, ..., 20
            valor: i === data.numeroParcelas
              ? valorParaParcelas - (valorParcela * (data.numeroParcelas - 1)) // Ajustar última parcela para compensar arredondamentos
              : valorParcela,
            dataVencimento: dataVencimentoParcela,
            status: StatusPagamento.PENDENTE
          })
        }
        await prisma.parcela.createMany({
          data: parcelas
        })
      } else {
        // Criar parcela única para pagamento à vista
        const dataVencimentoAvista = new Date(data.dataVencimento)
        dataVencimentoAvista.setHours(12, 0, 0, 0) // Ajustar timezone
        await prisma.parcela.create({
          data: {
            acordoId: acordo.id,
            numero: 1,
            valor: data.valorFinal,
            dataVencimento: dataVencimentoAvista,
            status: StatusPagamento.PENDENTE
          }
        })
      }
    }
    // Para COMPENSACAO e DACAO_PAGAMENTO, não criar parcelas
    // O cumprimento será validado através dos detalhes específicos do acordo
    // Atualizar status do processo
    await prisma.processo.update({
      where: { id: data.processoId },
      data: { status: 'EM_CUMPRIMENTO' }
    })
    // Registrar no histórico do processo
    let valorParaHistorico = Number(acordo.valorFinal)
    let descricaoAdicional = ''

    // Para compensação, usar valor dos créditos ofertados
    if (processo.tipo === 'COMPENSACAO' && data.dadosEspecificos?.valorCreditos) {
      valorParaHistorico = Number(data.dadosEspecificos.valorCreditos)
      descricaoAdicional = ''
    } else if (processo.tipo === 'DACAO_PAGAMENTO' && data.dadosEspecificos?.valorOferecido) {
      // Para dação em pagamento, usar valor das inscrições oferecidas
      valorParaHistorico = Number(data.dadosEspecificos.valorOferecido)
      descricaoAdicional = ''
    } else if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
      descricaoAdicional = acordo.modalidadePagamento === 'avista' ? ' - Pagamento à vista' : ` - Parcelamento em ${acordo.numeroParcelas}x`
    }

    // Definir título baseado no tipo de processo
    let tituloHistorico = 'Acordo de Pagamento Criado'
    if (processo.tipo === 'COMPENSACAO') {
      tituloHistorico = 'Acordo de Compensação Criado'
    } else if (processo.tipo === 'DACAO_PAGAMENTO') {
      tituloHistorico = 'Acordo de Dação em Pagamento Criado'
    }

    await prisma.historicoProcesso.create({
      data: {
        processoId: data.processoId,
        usuarioId: user.id,
        titulo: tituloHistorico,
        descricao: `Termo ${numeroTermo}${descricaoAdicional} - Valor: R$ ${valorParaHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        tipo: 'ACORDO'
      }
    })
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Acordo',
        entidadeId: acordo.id,
        dadosNovos: {
          processoNumero: processo.numero,
          contribuinte: processo.contribuinte.nome,
          valorTotal: acordo.valorTotal,
          valorFinal: acordo.valorFinal,
          modalidadePagamento: acordo.modalidadePagamento,
          numeroParcelas: acordo.numeroParcelas,
          dataAssinatura: acordo.dataAssinatura,
          dataVencimento: acordo.dataVencimento
        }
      }
    })
    // Buscar acordo completo para retorno
    const acordoCompleto = await prisma.acordo.findUnique({
      where: { id: acordo.id },
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
    console.error('Erro completo ao criar acordo:', error)
    // Se for erro de validação do Prisma, retornar detalhes
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Código do erro Prisma:', (error as { code?: string }).code)
      console.error('Meta do erro Prisma:', (error as { meta?: unknown }).meta)
    }
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}