import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { processoSchema } from '@/lib/validations/processo'
import { SessionUser, ProcessoWhereFilter } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const where: ProcessoWhereFilter = {}
    
    if (search) {
      const cleanedSearch = search.replace(/\D/g, '')
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { contribuinte: { nome: { contains: search, mode: 'insensitive' } } }
      ]
      
      // Só adicionar busca por CPF/CNPJ se houver números na busca
      if (cleanedSearch.length > 0) {
        where.OR.push({ contribuinte: { cpfCnpj: { contains: cleanedSearch } } })
      }
    }
    
    if (tipo) {
      where.tipo = tipo
    }
    
    if (status) {
      // Converter string separada por vírgula em array para usar com 'in'
      const statusArray = status.split(',').map(s => s.trim())
      where.status = { in: statusArray }
    }

    const [processos, total] = await Promise.all([
      prisma.processo.findMany({
        where,
        include: {
          contribuinte: true,
          tramitacoes: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          acordo: {
            include: {
              parcelas: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.processo.count({ where })
    ])


    return NextResponse.json({
      processos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar processos:', error)
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

    // Apenas Admin e Funcionário podem criar processos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar processos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = processoSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const { contribuinte: contribuinteData, ...processoData } = validationResult.data

    // Verificar se o número do processo já existe
    const existingProcesso = await prisma.processo.findUnique({
      where: { numero: processoData.numero }
    })

    if (existingProcesso) {
      return NextResponse.json(
        { error: 'Número de processo já existe' },
        { status: 400 }
      )
    }

    // Verificar se o contribuinte já existe pelo CPF/CNPJ
    let contribuinte = await prisma.contribuinte.findUnique({
      where: { cpfCnpj: contribuinteData.cpfCnpj.replace(/\D/g, '') }
    })

    // Se não existir, criar novo contribuinte
    if (!contribuinte) {
      contribuinte = await prisma.contribuinte.create({
        data: {
          ...contribuinteData,
          cpfCnpj: contribuinteData.cpfCnpj.replace(/\D/g, '')
        }
      })
    } else {
      // Atualizar dados do contribuinte existente
      contribuinte = await prisma.contribuinte.update({
        where: { id: contribuinte.id },
        data: {
          ...contribuinteData,
          cpfCnpj: contribuinteData.cpfCnpj.replace(/\D/g, '')
        }
      })
    }

    // Criar o processo
    const processo = await prisma.processo.create({
      data: {
        ...processoData,
        valorOriginal: processoData.valorOriginal,
        valorNegociado: processoData.valorNegociado || null,
        contribuinteId: contribuinte.id,
        createdById: user.id
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

    // Criar tramitação inicial
    await prisma.tramitacao.create({
      data: {
        processoId: processo.id,
        setorOrigem: 'CCF',
        setorDestino: 'ANÁLISE INICIAL',
        observacoes: 'Processo criado e direcionado para análise de admissibilidade',
        usuarioId: user.id
      }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Processo',
        entidadeId: processo.id,
        dadosNovos: {
          numero: processo.numero,
          tipo: processo.tipo,
          valorOriginal: processo.valorOriginal,
          contribuinte: contribuinte.nome
        }
      }
    })

    return NextResponse.json(processo, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}