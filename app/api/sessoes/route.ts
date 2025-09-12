import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { sessaoSchema } from '@/lib/validations/pauta'
import { SessionUser, PrismaWhereFilter } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'ativa' ou 'finalizada'
    const ano = searchParams.get('ano')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const where: PrismaWhereFilter = {}
    
    if (search) {
      where.OR = [
        { pauta: { numero: { contains: search, mode: 'insensitive' } } },
        { conselheiros: { some: { nome: { contains: search, mode: 'insensitive' } } } }
      ]
    }
    
    if (status === 'ativa') {
      where.dataFim = null
    } else if (status === 'finalizada') {
      where.dataFim = { not: null }
    }
    
    if (ano) {
      const startDate = new Date(`${ano}-01-01`)
      const endDate = new Date(`${ano}-12-31`)
      where.dataInicio = {
        gte: startDate,
        lte: endDate
      }
    }

    const [sessoes, total] = await Promise.all([
      prisma.sessaoJulgamento.findMany({
        where,
        include: {
          pauta: {
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
          },
          decisoes: {
            include: {
              processo: {
                include: {
                  contribuinte: true
                }
              }
            }
          },
          presidente: {
            select: {
              id: true,
              nome: true,
              email: true,
              cargo: true
            }
          },
          conselheiros: {
            select: {
              id: true,
              nome: true,
              email: true,
              cargo: true
            }
          }
        },
        orderBy: { dataInicio: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.sessaoJulgamento.count({ where })
    ])

    // Converter valores Decimal para number antes de retornar
    const sessoesSerializadas = sessoes.map(sessao => ({
      ...sessao,
      pauta: {
        ...sessao.pauta,
        processos: sessao.pauta.processos.map(processoPauta => ({
          ...processoPauta,
          processo: {
            ...processoPauta.processo,
            valorOriginal: processoPauta.processo.valorOriginal ? Number(processoPauta.processo.valorOriginal) : null,
            valorNegociado: processoPauta.processo.valorNegociado ? Number(processoPauta.processo.valorNegociado) : null
          }
        }))
      },
      decisoes: sessao.decisoes.map(decisao => ({
        ...decisao,
        processo: {
          ...decisao.processo,
          valorOriginal: decisao.processo.valorOriginal ? Number(decisao.processo.valorOriginal) : null,
          valorNegociado: decisao.processo.valorNegociado ? Number(decisao.processo.valorNegociado) : null
        }
      }))
    }))

    return NextResponse.json({
      sessoes: sessoesSerializadas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar sessões:', error)
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

    // Apenas Admin e Funcionário podem criar sessões
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar sessões' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Converter dataInicio para Date se necessário
    if (body.dataInicio) {
      body.dataInicio = new Date(body.dataInicio)
    }

    const validationResult = sessaoSchema.safeParse(body)

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

    // Verificar se a pauta existe e está aberta
    const pauta = await prisma.pauta.findUnique({
      where: { id: data.pautaId },
      include: {
        processos: {
          include: {
            processo: {
              include: {
                contribuinte: true
              }
            }
          }
        },
        sessao: true
      }
    })

    if (!pauta) {
      return NextResponse.json(
        { error: 'Pauta não encontrada' },
        { status: 404 }
      )
    }

    if (pauta.status !== 'aberta') {
      return NextResponse.json(
        { error: 'Apenas pautas com status "aberta" podem ter sessões criadas' },
        { status: 400 }
      )
    }

    if (pauta.sessao) {
      return NextResponse.json(
        { error: 'Esta pauta já possui uma sessão de julgamento' },
        { status: 400 }
      )
    }

    // Verificar se o presidente existe e está ativo (se fornecido)
    let presidente = null
    if (data.presidenteId) {
      presidente = await prisma.conselheiro.findUnique({
        where: { id: data.presidenteId, ativo: true }
      })

      if (!presidente) {
        return NextResponse.json(
          { error: 'Presidente selecionado não encontrado ou inativo' },
          { status: 400 }
        )
      }
    }

    // Verificar se todos os conselheiros participantes existem e estão ativos
    const conselheiros = await prisma.conselheiro.findMany({
      where: { 
        id: { in: data.conselheiros },
        ativo: true
      }
    })

    if (conselheiros.length !== data.conselheiros.length) {
      return NextResponse.json(
        { error: 'Um ou mais conselheiros não foram encontrados ou não são elegíveis' },
        { status: 400 }
      )
    }

    // Criar a sessão
    const sessao = await prisma.sessaoJulgamento.create({
      data: {
        pautaId: data.pautaId,
        dataInicio: data.dataInicio,
        ata: data.ata || '',
        presidenteId: data.presidenteId || null,
        conselheiros: {
          connect: data.conselheiros.map(id => ({ id }))
        }
      },
      include: {
        pauta: {
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
        },
        presidente: {
          select: {
            id: true,
            nome: true,
            email: true,
            cargo: true
          }
        },
        conselheiros: {
          select: {
            id: true,
            nome: true,
            email: true,
            cargo: true
          }
        }
      }
    })

    // Atualizar status da pauta para EM_JULGAMENTO
    await prisma.pauta.update({
      where: { id: data.pautaId },
      data: { status: 'em_julgamento' }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'SessaoJulgamento',
        entidadeId: sessao.id,
        dadosNovos: {
          pautaNumero: pauta.numero,
          dataInicio: sessao.dataInicio,
          totalProcessos: pauta.processos.length,
          presidente: presidente ? {
            id: presidente.id,
            nome: presidente.nome,
            email: presidente.email
          } : null,
          conselheiros: conselheiros.map(c => ({
            id: c.id,
            nome: c.nome,
            email: c.email
          })),
          processos: pauta.processos.map(p => ({
            numero: p.processo.numero,
            contribuinte: p.processo.contribuinte.nome,
            ordem: p.ordem
          }))
        }
      }
    })

    // Converter valores Decimal para number antes de retornar
    const sessaoSerializada = {
      ...sessao,
      pauta: {
        ...sessao.pauta,
        processos: sessao.pauta.processos.map(processoPauta => ({
          ...processoPauta,
          processo: {
            ...processoPauta.processo,
            valorOriginal: processoPauta.processo.valorOriginal ? Number(processoPauta.processo.valorOriginal) : null,
            valorNegociado: processoPauta.processo.valorNegociado ? Number(processoPauta.processo.valorNegociado) : null
          }
        }))
      }
    }

    return NextResponse.json(sessaoSerializada, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}