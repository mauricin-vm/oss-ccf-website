import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { SessionUser } from '@/types'

const votoSchema = z.object({
  tipoVoto: z.enum(['RELATOR', 'REVISOR', 'CONSELHEIRO']),
  nomeVotante: z.string().min(1, 'Nome do votante é obrigatório'),
  conselheiroId: z.string().optional(),
  textoVoto: z.string().optional(),
  posicaoVoto: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  acompanhaVoto: z.string().optional(),
  ordemApresentacao: z.number().optional(),
  isPresidente: z.boolean().optional()
})

const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  tipoResultado: z.enum(['SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'JULGADO'], {
    required_error: 'Tipo de resultado é obrigatório'
  }),
  // Para JULGADO
  tipoDecisao: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  // Para todos
  fundamentacao: z.string().min(10, 'Fundamentação deve ter pelo menos 10 caracteres'),
  // Para SUSPENSO
  motivoSuspensao: z.string().optional(),
  // Para PEDIDO_VISTA
  conselheiroPedidoVista: z.string().optional(),
  prazoVista: z.string().optional(), // ISO date string
  // Para PEDIDO_DILIGENCIA
  especificacaoDiligencia: z.string().optional(),
  prazoDiligencia: z.string().optional(), // ISO date string
  // Para acordos
  definirAcordo: z.boolean().optional(),
  tipoAcordo: z.enum(['aceita_proposta', 'contra_proposta', 'sem_acordo']).optional(),
  // Texto da ata específico do processo
  ataTexto: z.string().optional(),
  // Votos
  votos: z.array(votoSchema).optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const decisoes = await prisma.decisao.findMany({
      where: { sessaoId: id },
      include: {
        processo: {
          include: {
            contribuinte: true
          }
        },
        votos: {
          include: {
            conselheiro: true
          },
          orderBy: { ordemApresentacao: 'asc' }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      where: { id: id },
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

    // Usar transação para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      // Criar a decisão
      const decisao = await tx.decisao.create({
        data: {
          sessaoId: id,
          processoId: data.processoId,
          tipoResultado: data.tipoResultado,
          tipoDecisao: data.tipoDecisao || null,
          fundamentacao: data.fundamentacao,
          motivoSuspensao: data.motivoSuspensao || null,
          conselheiroPedidoVista: data.conselheiroPedidoVista || null,
          prazoVista: data.prazoVista ? new Date(data.prazoVista) : null,
          especificacaoDiligencia: data.especificacaoDiligencia || null,
          prazoDiligencia: data.prazoDiligencia ? new Date(data.prazoDiligencia) : null,
          definirAcordo: data.definirAcordo || false,
          tipoAcordo: data.tipoAcordo || null
        },
        include: {
          processo: {
            include: {
              contribuinte: true
            }
          }
        }
      })

      // Criar votos se fornecidos
      if (data.votos && data.votos.length > 0) {
        await tx.voto.createMany({
          data: data.votos.map(voto => ({
            decisaoId: decisao.id,
            conselheiroId: voto.conselheiroId || null,
            tipoVoto: voto.tipoVoto,
            nomeVotante: voto.nomeVotante,
            textoVoto: voto.textoVoto || null,
            posicaoVoto: voto.posicaoVoto || null,
            acompanhaVoto: voto.acompanhaVoto || null,
            ordemApresentacao: voto.ordemApresentacao || null,
            isPresidente: voto.isPresidente || false
          }))
        })
      }

      // Atualizar ProcessoPauta com informações específicas da sessão
      await tx.processoPauta.updateMany({
        where: {
          processoId: data.processoId,
          pauta: {
            sessao: {
              id: id
            }
          }
        },
        data: {
          statusSessao: data.tipoResultado,
          ataTexto: data.ataTexto || null,
          motivoSuspensao: data.motivoSuspensao || null,
          prazoVista: data.prazoVista ? new Date(data.prazoVista) : null,
          prazoDialigencia: data.prazoDiligencia ? new Date(data.prazoDiligencia) : null,
          observacoesSessao: data.fundamentacao
        }
      })

      // Atualizar status do processo baseado no resultado
      let novoStatusProcesso: string
      switch (data.tipoResultado) {
        case 'SUSPENSO':
          novoStatusProcesso = 'SUSPENSO'
          break
        case 'PEDIDO_VISTA':
          novoStatusProcesso = 'PEDIDO_VISTA'
          break
        case 'PEDIDO_DILIGENCIA':
          novoStatusProcesso = 'PEDIDO_DILIGENCIA'
          break
        case 'JULGADO':
          if (data.definirAcordo) {
            novoStatusProcesso = 'AGUARDANDO_ACORDO'
          } else {
            novoStatusProcesso = 'JULGADO'
          }
          break
        default:
          novoStatusProcesso = 'JULGADO'
      }

      await tx.processo.update({
        where: { id: data.processoId },
        data: { status: novoStatusProcesso as any }
      })

      return decisao
    })

    const decisao = result

    // Verificar se todos os processos foram julgados
    const totalProcessos = sessao.pauta.processos.length
    const totalDecisoes = sessao.decisoes.length + 1 // +1 pela decisão que acabamos de criar

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Decisao',
        entidadeId: decisao.id,
        dadosNovos: {
          sessaoId: id,
          processoNumero: processoNaPauta.processo.numero,
          contribuinte: decisao.processo.contribuinte.nome,
          tipoResultado: decisao.tipoResultado,
          tipoDecisao: decisao.tipoDecisao,
          fundamentacao: decisao.fundamentacao,
          definirAcordo: decisao.definirAcordo,
          progressoSessao: `${totalDecisoes}/${totalProcessos}`,
          votosCount: data.votos?.length || 0
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