import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { tramitacaoSchema } from '@/lib/validations/processo'
import { SessionUser, PrismaWhereFilter } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const setor = searchParams.get('setor')
    const status = searchParams.get('status') // 'pendente', 'recebida', 'atrasada'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const where: PrismaWhereFilter = {}
    
    if (search) {
      where.OR = [
        { processo: { numero: { contains: search, mode: 'insensitive' } } },
        { processo: { contribuinte: { nome: { contains: search, mode: 'insensitive' } } } },
        { setorOrigem: { contains: search, mode: 'insensitive' } },
        { setorDestino: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (setor) {
      where.OR = [
        { setorOrigem: setor },
        { setorDestino: setor }
      ]
    }
    
    if (status) {
      switch (status) {
        case 'pendente':
          where.dataRecebimento = null
          where.OR = [
            { prazoResposta: null },
            { prazoResposta: { gte: new Date() } }
          ]
          break
        case 'recebida':
          where.dataRecebimento = { not: null }
          break
        case 'atrasada':
          where.dataRecebimento = null
          where.prazoResposta = { lt: new Date() }
          break
      }
    }

    const [tramitacoes, total, setores] = await Promise.all([
      prisma.tramitacao.findMany({
        where,
        include: {
          processo: {
            include: {
              contribuinte: true
            }
          },
          usuario: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.tramitacao.count({ where }),
      prisma.setor.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' }
      })
    ])

    return NextResponse.json({
      tramitacoes,
      setores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar tramitações:', error)
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

    // Apenas Admin e Funcionário podem criar tramitações
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar tramitações' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Converter prazoResposta para Date se fornecido
    if (body.prazoResposta) {
      body.prazoResposta = new Date(body.prazoResposta)
    }

    const validationResult = tramitacaoSchema.safeParse(body)

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

    // Verificar se o processo existe
    const processo = await prisma.processo.findUnique({
      where: { id: data.processoId },
      include: { contribuinte: true }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o setor de origem é válido
    if (data.setorOrigem === data.setorDestino) {
      return NextResponse.json(
        { error: 'Setor de origem e destino não podem ser iguais' },
        { status: 400 }
      )
    }

    // Verificar se há tramitação pendente para este processo
    const tramitacaoPendente = await prisma.tramitacao.findFirst({
      where: {
        processoId: data.processoId,
        dataRecebimento: null
      }
    })

    if (tramitacaoPendente) {
      return NextResponse.json(
        { error: 'Já existe uma tramitação pendente para este processo' },
        { status: 400 }
      )
    }

    // Criar a tramitação
    const tramitacao = await prisma.tramitacao.create({
      data: {
        processoId: data.processoId,
        setorOrigem: data.setorOrigem,
        setorDestino: data.setorDestino,
        prazoResposta: data.prazoResposta,
        observacoes: data.observacoes,
        usuarioId: user.id
      },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        usuario: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Atualizar status do processo se necessário
    let novoStatus = processo.status
    if (processo.status === 'RECEPCIONADO' && data.setorDestino !== 'CCF') {
      novoStatus = 'EM_ANALISE'
    }

    if (novoStatus !== processo.status) {
      await prisma.processo.update({
        where: { id: data.processoId },
        data: { status: novoStatus }
      })
    }

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Tramitacao',
        entidadeId: tramitacao.id,
        dadosNovos: {
          processoNumero: processo.numero,
          setorOrigem: data.setorOrigem,
          setorDestino: data.setorDestino,
          prazoResposta: data.prazoResposta,
          observacoes: data.observacoes
        }
      }
    })

    return NextResponse.json(tramitacao, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tramitação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}