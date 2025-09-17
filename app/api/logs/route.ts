import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    // Apenas Admin pode visualizar logs
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para visualizar logs' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const acao = searchParams.get('acao')
    const entidade = searchParams.get('entidade')
    const usuarioId = searchParams.get('usuarioId')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // Construir filtros
    const where: Prisma.LogAuditoriaWhereInput = {}

    if (acao && acao !== 'all') {
      where.acao = acao
    }

    if (entidade && entidade !== 'all') {
      where.entidade = entidade
    }

    if (usuarioId) {
      where.usuarioId = usuarioId
    }

    if (search) {
      where.OR = [
        { acao: { contains: search, mode: 'insensitive' } },
        { entidade: { contains: search, mode: 'insensitive' } },
        { entidadeId: { contains: search, mode: 'insensitive' } },
        { usuario: { name: { contains: search, mode: 'insensitive' } } },
        { usuario: { email: { contains: search, mode: 'insensitive' } } }
      ]
    }

    // Buscar logs com paginação
    const [logs, total] = await Promise.all([
      prisma.logAuditoria.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.logAuditoria.count({ where })
    ])

    // Buscar estatísticas
    const stats = await Promise.all([
      // Total de logs
      prisma.logAuditoria.count(),

      // Logs das últimas 24h
      prisma.logAuditoria.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Usuários únicos que fizeram ações
      prisma.logAuditoria.findMany({
        select: { usuarioId: true },
        distinct: ['usuarioId']
      }),

      // Ações críticas (DELETE)
      prisma.logAuditoria.count({
        where: { acao: 'DELETE' }
      }),

      // Ações únicas
      prisma.logAuditoria.findMany({
        select: { acao: true },
        distinct: ['acao']
      }),

      // Entidades únicas
      prisma.logAuditoria.findMany({
        select: { entidade: true },
        distinct: ['entidade']
      })
    ])

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }

    const statistics = {
      totalLogs: stats[0],
      logsLast24h: stats[1],
      uniqueUsers: stats[2].length,
      criticalActions: stats[3],
      uniqueActions: stats[4].map(item => item.acao),
      uniqueEntities: stats[5].map(item => item.entidade)
    }

    return NextResponse.json({
      logs,
      pagination,
      statistics
    })
  } catch (error) {
    console.error('Erro ao buscar logs:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}