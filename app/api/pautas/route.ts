import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { pautaSchema } from '@/lib/validations/pauta'
import { SessionUser, PrismaWhereFilter } from '@/types'

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
    
    const where: PrismaWhereFilter = {}
    
    if (search) {
      where.numero = { contains: search, mode: 'insensitive' }
    }
    
    if (status) {
      where.status = status
    }
    
    if (ano) {
      const startDate = new Date(`${ano}-01-01`)
      const endDate = new Date(`${ano}-12-31`)
      where.dataPauta = {
        gte: startDate,
        lte: endDate
      }
    }

    const [pautas, total] = await Promise.all([
      prisma.pauta.findMany({
        where,
        include: {
          processos: {
            include: {
              processo: {
                include: {
                  contribuinte: true
                }
              }
            },
            orderBy: { ordem: 'asc' }
          },
          sessao: {
            include: {
              decisoes: true,
              conselheiros: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: { dataPauta: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.pauta.count({ where })
    ])

    return NextResponse.json({
      pautas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar pautas:', error)
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

    // Apenas Admin e Funcionário podem criar pautas
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar pautas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Converter dataPauta para Date
    if (body.dataPauta) {
      body.dataPauta = new Date(body.dataPauta)
    }

    const validationResult = pautaSchema.safeParse(body)

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

    // Verificar se o número da pauta já existe
    const existingPauta = await prisma.pauta.findUnique({
      where: { numero: data.numero }
    })

    if (existingPauta) {
      return NextResponse.json(
        { error: 'Número de pauta já existe' },
        { status: 400 }
      )
    }

    // Verificar se todos os processos existem e estão elegíveis
    const processosIds = data.processos.map(p => p.processoId)
    const processos = await prisma.processo.findMany({
      where: { id: { in: processosIds } },
      include: { contribuinte: true }
    })

    if (processos.length !== processosIds.length) {
      return NextResponse.json(
        { error: 'Um ou mais processos não foram encontrados' },
        { status: 400 }
      )
    }

    // Verificar se os processos estão em status adequado para pauta
    const processosInelegiveis = processos.filter(p => 
      !['EM_ANALISE', 'AGUARDANDO_DOCUMENTOS'].includes(p.status)
    )

    if (processosInelegiveis.length > 0) {
      return NextResponse.json(
        { 
          error: `Os seguintes processos não estão elegíveis para pauta: ${processosInelegiveis.map(p => p.numero).join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Criar a pauta
    const pauta = await prisma.pauta.create({
      data: {
        numero: data.numero,
        dataPauta: data.dataPauta,
        status: 'aberta',
        observacoes: data.observacoes,
        processos: {
          create: data.processos.map(p => ({
            processoId: p.processoId,
            ordem: p.ordem,
            relator: p.relator
          }))
        }
      },
      include: {
        processos: {
          include: {
            processo: {
              include: {
                contribuinte: true
              }
            }
          },
          orderBy: { ordem: 'asc' }
        }
      }
    })

    // Atualizar status dos processos para EM_PAUTA
    await prisma.processo.updateMany({
      where: { id: { in: processosIds } },
      data: { status: 'EM_PAUTA' }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Pauta',
        entidadeId: pauta.id,
        dadosNovos: {
          numero: pauta.numero,
          dataPauta: pauta.dataPauta,
          totalProcessos: data.processos.length,
          processos: processos.map(p => ({
            numero: p.numero,
            contribuinte: p.contribuinte.nome
          }))
        }
      }
    })

    return NextResponse.json(pauta, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pauta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}