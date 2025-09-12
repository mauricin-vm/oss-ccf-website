import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { z } from 'zod'

const statusSchema = z.object({
  status: z.enum([
    'RECEPCIONADO',
    'EM_ANALISE',
    'EM_PAUTA',
    'SUSPENSO',
    'PEDIDO_VISTA',
    'PEDIDO_DILIGENCIA',
    'JULGADO',
    'ACORDO_FIRMADO',
    'EM_CUMPRIMENTO',
    'ARQUIVADO'
  ])
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const { id } = await params

    // Apenas Admin e Funcionário podem alterar status
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para alterar status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = statusSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const { status } = validationResult.data

    // Buscar processo atual
    const processoAtual = await prisma.processo.findUnique({
      where: { id },
      select: { 
        id: true, 
        numero: true, 
        status: true 
      }
    })

    if (!processoAtual) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Se o status não mudou, retornar sem fazer nada
    if (processoAtual.status === status) {
      return NextResponse.json({
        message: 'Status já está atualizado',
        processo: processoAtual
      })
    }

    // Atualizar o status
    const processoAtualizado = await prisma.processo.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date()
      }
    })

    // Criar histórico da mudança de status usando query raw
    try {
      await prisma.$queryRaw`
        INSERT INTO "HistoricoProcesso" ("id", "processoId", "usuarioId", "titulo", "descricao", "tipo", "createdAt")
        VALUES (
          gen_random_uuid(), 
          ${id}, 
          ${user.id}, 
          'Status Alterado', 
          ${`Status alterado de ${processoAtual.status} para ${status}`}, 
          'ALTERACAO', 
          NOW()
        )
      `
    } catch (error) {
      console.error('Erro ao criar histórico de mudança de status:', error)
    }

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Processo',
        entidadeId: id,
        dadosAnteriores: {
          status: processoAtual.status
        },
        dadosNovos: {
          status: status
        }
      }
    })

    return NextResponse.json({
      message: 'Status atualizado com sucesso',
      processo: processoAtualizado
    })
  } catch (error) {
    console.error('Erro ao atualizar status:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}