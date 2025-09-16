import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { acordoSchema } from '@/lib/validations/acordo'
import { SessionUser, AcordoWhereFilter } from '@/types'
async function criarDetalhesEspecificos(acordoId: string, tipoProcesso: string, dadosEspecificos: Record<string, unknown>) {
  console.log('🔍 Criando detalhes específicos para:', { acordoId, tipoProcesso })
  console.log('📋 Dados específicos recebidos:', JSON.stringify(dadosEspecificos, null, 2))
  switch (tipoProcesso) {
    case 'TRANSACAO_EXCEPCIONAL':
      // Verificar se tem dados de inscrições (novo formato) ou formato antigo
      const inscricoesData = dadosEspecificos.inscricoesAcordo || dadosEspecificos.inscricoesSelecionadas
      console.log('📝 Inscrições encontradas:', inscricoesData?.length || 0)
      if (inscricoesData?.length > 0) {
        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'transacao',
            descricao: 'Transação Excepcional - Acordo Final',
            valorOriginal: dadosEspecificos.valorInscricoes || 0,
            status: 'PENDENTE',
            observacoes: dadosEspecificos.observacoesAcordo || null
          }
        })
        // Criar registros detalhados das inscrições
        for (const inscricao of inscricoesData) {
          // Calcular valor total dos débitos para esta inscrição
          const valorDebitos = inscricao.debitos?.reduce(
            (total: number, debito: Record<string, unknown>) => total + (Number(debito?.valor) || 0), 0
          ) || 0
          // Preparar lista de débitos para salvar no JSON
          const debitosDetalhados = (inscricao.debitos as Record<string, unknown>[])?.map((debito: Record<string, unknown>) => ({
            id: debito.id,
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
              descricaoDebitos: debitosDetalhados
            }
          })
        }
      }
      break
    case 'COMPENSACAO':
      if (dadosEspecificos.creditosSelecionados?.length > 0 || dadosEspecificos.inscricoesSelecionadas?.length > 0) {
        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'compensacao',
            descricao: 'Compensação de Créditos e Débitos',
            valorOriginal: Math.max(dadosEspecificos.valorCreditos || 0, dadosEspecificos.valorDebitos || 0),
            status: 'PENDENTE'
          }
        })
        // Criar registros para inscrições compensadas
        if (dadosEspecificos.inscricoesSelecionadas?.length > 0) {
          for (const inscricaoId of dadosEspecificos.inscricoesSelecionadas) {
            await prisma.acordoInscricao.create({
              data: {
                acordoDetalheId: detalhe.id,
                numeroInscricao: inscricaoId,
                tipoInscricao: 'economica',
                valorDebito: dadosEspecificos.valorDebitos || 0,
                valorAbatido: dadosEspecificos.valorCompensacao || 0,
                percentualAbatido: 0,
                situacao: 'pendente'
              }
            })
          }
        }
      }
      break
    case 'DACAO_PAGAMENTO':
      if (dadosEspecificos.inscricoesOferecidas?.length > 0 || dadosEspecificos.inscricoesCompensar?.length > 0) {
        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'dacao',
            descricao: 'Dação em Pagamento',
            valorOriginal: dadosEspecificos.valorCompensar || 0,
            status: 'PENDENTE'
          }
        })
        // Criar registros para inscrições a compensar
        if (dadosEspecificos.inscricoesCompensar?.length > 0) {
          for (const inscricaoId of dadosEspecificos.inscricoesCompensar) {
            await prisma.acordoInscricao.create({
              data: {
                acordoDetalheId: detalhe.id,
                numeroInscricao: inscricaoId,
                tipoInscricao: 'imobiliaria',
                valorDebito: dadosEspecificos.valorCompensar || 0,
                valorAbatido: dadosEspecificos.valorDacao || 0,
                percentualAbatido: 0,
                situacao: 'pendente'
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
    // DEBUG: Log dos dados recebidos
    console.log('=== DEBUG ACORDO ===')
    console.log('Dados recebidos:', JSON.stringify(body, null, 2))
    console.log('Dados específicos:', JSON.stringify(body.dadosEspecificos, null, 2))
    console.log('==================')
    console.log('📅 Iniciando conversão de datas...')
    console.log('📅 dataAssinatura original:', body.dataAssinatura, typeof body.dataAssinatura)
    console.log('📅 dataVencimento original:', body.dataVencimento, typeof body.dataVencimento)
    // Converter datas (ajustar timezone para evitar diferença de um dia)
    if (body.dataAssinatura) {
      try {
        const dataAssinatura = new Date(body.dataAssinatura)
        console.log('📅 dataAssinatura convertida:', dataAssinatura)
        dataAssinatura.setHours(12, 0, 0, 0) // Meio-dia para evitar problemas de timezone
        body.dataAssinatura = dataAssinatura
        console.log('📅 dataAssinatura final:', body.dataAssinatura)
      } catch (error) {
        console.error('❌ Erro ao converter dataAssinatura:', error)
        throw error
      }
    }
    if (body.dataVencimento) {
      try {
        const dataVencimento = new Date(body.dataVencimento)
        console.log('📅 dataVencimento convertida:', dataVencimento)
        dataVencimento.setHours(12, 0, 0, 0) // Meio-dia para evitar problemas de timezone
        body.dataVencimento = dataVencimento
        console.log('📅 dataVencimento final:', body.dataVencimento)
      } catch (error) {
        console.error('❌ Erro ao converter dataVencimento:', error)
        throw error
      }
    }
    console.log('✅ Conversão de datas concluída')
    console.log('🔍 Iniciando validação do schema...')
    const validationResult = acordoSchema.safeParse(body)
    if (!validationResult.success) {
      console.log('❌ Erro de validação:', validationResult.error.issues)
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }
    console.log('✅ Validação do schema passou')
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
      console.log('ℹ️ Processo tem acordo cancelado, permitindo criação de novo acordo')
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
      console.log('=== CÁLCULO TRANSAÇÃO EXCEPCIONAL ===')
      console.log('Valor das inscrições:', data.dadosEspecificos.valorInscricoes)
      console.log('Valor final:', data.valorFinal)
      valorOriginal = data.dadosEspecificos.valorInscricoes
      valorDesconto = valorOriginal - data.valorFinal
      percentualDesconto = valorOriginal > 0 ? (valorDesconto / valorOriginal) * 100 : 0
      console.log('Valor original calculado:', valorOriginal)
      console.log('Valor desconto calculado:', valorDesconto)
      console.log('Percentual desconto calculado:', percentualDesconto)
      console.log('=====================================')
    }
    // Definir valor de entrada
    let valorEntrada = 0
    if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && data.dadosEspecificos?.propostaFinal?.valorEntrada) {
      valorEntrada = data.dadosEspecificos.propostaFinal.valorEntrada
    }
    // DEBUG: Verificar observações
    console.log('=== DEBUG OBSERVAÇÕES ===')
    console.log('data.observacoes:', data.observacoes)
    console.log('data.dadosEspecificos?.observacoesAcordo:', data.dadosEspecificos?.observacoesAcordo)
    console.log('==========================')
    // Criar o acordo
    console.log('🔥 Iniciando criação do acordo no banco...')
    const acordo = await prisma.acordo.create({
      data: {
        processoId: data.processoId,
        numeroTermo,
        valorTotal: valorOriginal,
        valorDesconto: valorDesconto,
        percentualDesconto: percentualDesconto,
        valorFinal: data.valorFinal,
        valorEntrada: valorEntrada > 0 ? valorEntrada : null,
        dataAssinatura: data.dataAssinatura,
        dataVencimento: data.dataVencimento,
        modalidadePagamento: data.modalidadePagamento,
        numeroParcelas: data.numeroParcelas || 1,
        observacoes: processo.tipo === 'TRANSACAO_EXCEPCIONAL' && data.dadosEspecificos?.observacoesAcordo
          ? data.dadosEspecificos.observacoesAcordo
          : data.observacoes,
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
    console.log('✅ Acordo criado no banco com ID:', acordo.id)
    // Criar detalhes específicos do acordo baseado no tipo de processo
    if (data.dadosEspecificos && processo.tipo) {
      console.log('🔧 Criando detalhes específicos...')
      await criarDetalhesEspecificos(acordo.id, processo.tipo, data.dadosEspecificos)
      console.log('✅ Detalhes específicos criados')
    }
    // Gerar parcelas se for parcelado
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
          status: 'PENDENTE'
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
          status: 'PENDENTE'
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
          status: 'PENDENTE'
        }
      })
    }
    // Atualizar status do processo
    await prisma.processo.update({
      where: { id: data.processoId },
      data: { status: 'EM_CUMPRIMENTO' }
    })
    // Registrar no histórico do processo
    await prisma.historicoProcesso.create({
      data: {
        processoId: data.processoId,
        usuarioId: user.id,
        titulo: 'Acordo de Pagamento Criado',
        descricao: `Termo ${numeroTermo} - ${acordo.modalidadePagamento === 'avista' ? 'Pagamento à vista' : `Parcelamento em ${acordo.numeroParcelas}x`}. Valor: R$ ${acordo.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
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
    console.error('❌ ERRO COMPLETO ao criar acordo:', error)
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('❌ Mensagem:', error instanceof Error ? error.message : String(error))
    // Se for erro de validação do Prisma, retornar detalhes
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('❌ Código do erro Prisma:', (error as { code?: string }).code)
      console.error('❌ Meta do erro Prisma:', (error as { meta?: unknown }).meta)
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