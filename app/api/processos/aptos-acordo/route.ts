import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50) // Máximo 50

    // Query otimizada para buscar apenas processos aptos a acordos
    const where: any = {
      AND: [
        // 1. Processo JULGADO
        { status: 'JULGADO' },

        // 2. Decisão DEFERIDA ou PARCIAL
        {
          decisoes: {
            some: {
              tipoDecisao: { in: ['DEFERIDO', 'PARCIAL'] }
            }
          }
        },

        // 3. SEM acordos ativos
        {
          OR: [
            { acordos: { none: {} } }, // Sem acordos
            {
              acordos: {
                none: {
                  status: 'ativo'
                }
              }
            } // Apenas acordos não ativos
          ]
        }
      ]
    }

    // Adicionar filtro de busca se fornecido
    if (search) {
      where.AND.push({
        OR: [
          { numero: { contains: search, mode: 'insensitive' as const } },
          { contribuinte: { nome: { contains: search, mode: 'insensitive' as const } } },
          ...(search.replace(/\D/g, '').length > 0 ? [
            { contribuinte: { cpfCnpj: { contains: search.replace(/\D/g, '') } } }
          ] : [])
        ]
      })
    }

    const [processos, total] = await Promise.all([
      prisma.processo.findMany({
        where,
        select: {
          id: true,
          numero: true,
          tipo: true,
          status: true,
          dataAbertura: true,
          contribuinte: {
            select: {
              id: true,
              nome: true,
              cpfCnpj: true
            }
          },
          // Incluir apenas a decisão relevante
          decisoes: {
            select: {
              id: true,
              tipoDecisao: true,
              dataDecisao: true
            },
            where: {
              tipoDecisao: { in: ['DEFERIDO', 'PARCIAL'] }
            },
            orderBy: { dataDecisao: 'desc' },
            take: 1
          }
        },
        orderBy: [
          { dataAbertura: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.processo.count({ where })
    ])

    // Processar dados dos processos
    const processosProcessados = processos.map(processo => ({
      id: processo.id,
      numero: processo.numero,
      tipo: processo.tipo,
      status: processo.status,
      dataAbertura: processo.dataAbertura,
      contribuinte: processo.contribuinte,
      tipoDecisao: processo.decisoes[0]?.tipoDecisao || null,
      dataDecisao: processo.decisoes[0]?.dataDecisao || null
    }))

    return NextResponse.json({
      processos: processosProcessados,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar processos aptos a acordos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}