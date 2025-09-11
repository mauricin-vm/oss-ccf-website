import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { SessionUser } from '@/types'

const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  tipo: z.enum(['deferido', 'indeferido', 'parcial'], {
    required_error: 'Tipo de decisão é obrigatório'
  }),
  descricao: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  observacoes: z.string().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const decisoes = await prisma.decisaoJulgamento.findMany({
      where: { sessaoId: params.id },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ decisoes })
  } catch (error) {
    console.error('Erro ao buscar decisões:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin e Funcionário podem registrar decisões
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para registrar decisões' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = decisaoSchema.safeParse(body)

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

    // Verificar se a sessão existe e está ativa
    const sessao = await prisma.sessaoJulgamento.findUnique({
      where: { id: params.id },
      include: {
        pauta: {
          include: {
            processos: {
              include: {
                processo: true
              }
            }
          }
        },
        decisoes: true
      }
    })

    if (!sessao) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    if (sessao.dataFim) {
      return NextResponse.json(
        { error: 'Não é possível registrar decisões em sessões finalizadas' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe na pauta
    const processoNaPauta = sessao.pauta.processos.find(
      p => p.processo.id === data.processoId
    )

    if (!processoNaPauta) {
      return NextResponse.json(
        { error: 'Processo não encontrado na pauta desta sessão' },
        { status: 400 }
      )
    }

    // Verificar se o processo já foi julgado
    const decisaoExistente = sessao.decisoes.find(
      d => d.processoId === data.processoId
    )

    if (decisaoExistente) {
      return NextResponse.json(
        { error: 'Este processo já foi julgado nesta sessão' },
        { status: 400 }
      )
    }

    // Criar a decisão
    const decisao = await prisma.decisaoJulgamento.create({
      data: {
        sessaoId: params.id,
        processoId: data.processoId,
        tipo: data.tipo,
        descricao: data.descricao,
        observacoes: data.observacoes || ''
      },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        }
      }
    })

    // Atualizar status do processo baseado na decisão
    let novoStatus = 'JULGADO'
    if (data.tipo === 'deferido') {
      novoStatus = 'DEFERIDO'
    } else if (data.tipo === 'indeferido') {
      novoStatus = 'INDEFERIDO'
    } else {
      novoStatus = 'DEFERIDO_PARCIAL'
    }

    await prisma.processo.update({
      where: { id: data.processoId },
      data: { status: novoStatus }
    })

    // Verificar se todos os processos foram julgados
    const totalProcessos = sessao.pauta.processos.length
    const totalDecisoes = sessao.decisoes.length + 1 // +1 pela decisão que acabamos de criar

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'DecisaoJulgamento',
        entidadeId: decisao.id,
        dadosNovos: {
          sessaoId: params.id,
          processoNumero: processoNaPauta.processo.numero,
          contribuinte: processoNaPauta.processo.contribuinte.nome,
          tipo: decisao.tipo,
          descricao: decisao.descricao,
          progressoSessao: `${totalDecisoes}/${totalProcessos}`
        }
      }
    })

    return NextResponse.json(decisao, { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar decisão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}