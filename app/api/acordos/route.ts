import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { acordoSchema } from '@/lib/validations/acordo'
import { SessionUser, AcordoWhereFilter } from '@/types'

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
    
    // Converter datas
    if (body.dataAssinatura) {
      body.dataAssinatura = new Date(body.dataAssinatura)
    }
    if (body.dataVencimento) {
      body.dataVencimento = new Date(body.dataVencimento)
    }

    const validationResult = acordoSchema.safeParse(body)

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

    // Verificar se o processo existe e está elegível
    const processo = await prisma.processo.findUnique({
      where: { id: data.processoId },
      include: {
        contribuinte: true,
        acordo: true
      }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    if (!['DEFERIDO', 'DEFERIDO_PARCIAL'].includes(processo.status)) {
      return NextResponse.json(
        { error: 'Apenas processos deferidos podem ter acordos' },
        { status: 400 }
      )
    }

    if (processo.acordo) {
      return NextResponse.json(
        { error: 'Este processo já possui um acordo' },
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

    // Criar o acordo
    const acordo = await prisma.acordo.create({
      data: {
        processoId: data.processoId,
        valorTotal: data.valorTotal,
        valorDesconto: data.valorDesconto || 0,
        percentualDesconto: data.percentualDesconto || 0,
        valorFinal: data.valorFinal,
        dataAssinatura: data.dataAssinatura,
        dataVencimento: data.dataVencimento,
        modalidadePagamento: data.modalidadePagamento,
        numeroParcelas: data.numeroParcelas || 1,
        observacoes: data.observacoes,
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

    // Gerar parcelas se for parcelado
    if (data.modalidadePagamento === 'parcelado' && data.numeroParcelas && data.numeroParcelas > 1) {
      const valorParcela = data.valorFinal / data.numeroParcelas
      const parcelas = []

      for (let i = 1; i <= data.numeroParcelas; i++) {
        const dataVencimentoParcela = new Date(data.dataAssinatura)
        dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i)

        parcelas.push({
          acordoId: acordo.id,
          numero: i,
          valor: i === data.numeroParcelas 
            ? data.valorFinal - (valorParcela * (data.numeroParcelas - 1)) // Ajustar última parcela para compensar arredondamentos
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
      await prisma.parcela.create({
        data: {
          acordoId: acordo.id,
          numero: 1,
          valor: data.valorFinal,
          dataVencimento: data.dataVencimento,
          status: 'PENDENTE'
        }
      })
    }

    // Atualizar status do processo
    await prisma.processo.update({
      where: { id: data.processoId },
      data: { status: 'EM_CUMPRIMENTO' }
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
    console.error('Erro ao criar acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}