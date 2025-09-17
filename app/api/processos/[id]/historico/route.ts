import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { z } from 'zod'
const historicoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo: z.string().default('EVENTO')
})
// GET - Listar histórico do processo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { id } = await params
    const historicos = await prisma.$queryRaw<Array<{
      id: string;
      titulo: string;
      descricao: string;
      tipo: string;
      createdAt: Date;
      userId: string;
      userName: string;
      userEmail: string;
      userRole: string;
    }>>`
      SELECT 
        hp.id,
        hp.titulo,
        hp.descricao,
        hp.tipo,
        hp."createdAt",
        u.id as "userId",
        u.name as "userName",
        u.email as "userEmail", 
        u.role as "userRole"
      FROM "HistoricoProcesso" hp
      LEFT JOIN "User" u ON u.id = hp."usuarioId"
      WHERE hp."processoId" = ${id}
      ORDER BY hp."createdAt" DESC
    `
    const formattedHistoricos = historicos.map(h => ({
      id: h.id,
      titulo: h.titulo,
      descricao: h.descricao,
      tipo: h.tipo,
      createdAt: h.createdAt,
      usuario: {
        id: h.userId,
        name: h.userName,
        email: h.userEmail,
        role: h.userRole
      }
    }))
    return NextResponse.json({ historicos: formattedHistoricos })
  } catch (error) {
    console.error('Erro ao listar histórico:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
// POST - Adicionar novo histórico
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    const { id: processoId } = await params
    // Apenas Admin e Funcionário podem adicionar histórico
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para adicionar histórico' },
        { status: 403 }
      )
    }
    // Verificar se o processo existe
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true, numero: true, status: true }
    })
    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }
    const body = await request.json()
    const validationResult = historicoSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.issues
        },
        { status: 400 }
      )
    }
    const { titulo, descricao, tipo } = validationResult.data
    // Usar transação para criar histórico e atualizar status
    const newHistoricoId = await prisma.$transaction(async (tx) => {
      // Criar histórico
      const novoHistorico = await tx.historicoProcesso.create({
        data: {
          processoId,
          usuarioId: user.id,
          titulo,
          descricao,
          tipo
        }
      })
      // Atualizar status para EM_ANALISE se for RECEPCIONADO
      if (processo.status === 'RECEPCIONADO') {
        await tx.processo.update({
          where: { id: processoId },
          data: { status: 'EM_ANALISE' }
        })
      }
      return novoHistorico.id
    })
    // Buscar o histórico criado com dados do usuário
    const historico = await prisma.$queryRaw<Array<{
      id: string;
      titulo: string;
      descricao: string;
      tipo: string;
      createdAt: Date;
      userId: string;
      userName: string;
      userEmail: string;
      userRole: string;
    }>>`
      SELECT 
        hp.id,
        hp.titulo,
        hp.descricao,
        hp.tipo,
        hp."createdAt",
        u.id as "userId",
        u.name as "userName",
        u.email as "userEmail", 
        u.role as "userRole"
      FROM "HistoricoProcesso" hp
      LEFT JOIN "User" u ON u.id = hp."usuarioId"
      WHERE hp.id = ${newHistoricoId}
    `
    const formattedHistorico = {
      id: historico[0].id,
      titulo: historico[0].titulo,
      descricao: historico[0].descricao,
      tipo: historico[0].tipo,
      createdAt: historico[0].createdAt,
      usuario: {
        id: historico[0].userId,
        name: historico[0].userName,
        email: historico[0].userEmail,
        role: historico[0].userRole
      }
    }
    // Log de auditoria
    const userExists = await prisma.user.findUnique({
      where: { id: user.id }
    })
    if (userExists) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'CREATE',
          entidade: 'HistoricoProcesso',
          entidadeId: formattedHistorico.id,
          dadosNovos: {
            titulo,
            descricao,
            tipo,
            processo: processo.numero
          }
        }
      })
    }
    return NextResponse.json({
      message: 'Histórico adicionado com sucesso',
      historico: formattedHistorico
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao adicionar histórico:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}