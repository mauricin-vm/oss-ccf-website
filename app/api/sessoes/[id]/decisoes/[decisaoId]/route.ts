import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { SessionUser } from '@/types'

// Funções auxiliares para histórico
function getTituloHistoricoDecisao(tipoResultado: string): string {
  switch (tipoResultado) {
    case 'SUSPENSO': return 'Processo Suspenso'
    case 'PEDIDO_VISTA': return 'Pedido de Vista'
    case 'PEDIDO_DILIGENCIA': return 'Pedido de Diligência'
    case 'JULGADO': return 'Processo Julgado'
    default: return 'Decisão Registrada'
  }
}

function getDescricaoHistoricoDecisao(data: any, decisao: any): string {
  switch (data.tipoResultado) {
    case 'SUSPENSO':
      return `Processo suspenso durante sessão de julgamento${data.motivoSuspensao ? `. Motivo: ${data.motivoSuspensao}` : '.'}`

    case 'PEDIDO_VISTA':
      return `Pedido de vista solicitado por ${data.conselheiroPedidoVista}${data.observacoes ? `. Observação: ${data.observacoes}` : '.'}`

    case 'PEDIDO_DILIGENCIA':
      let descDiligencia = `Pedido de diligência com prazo de ${data.prazoDiligencia} dias`
      if (data.especificacaoDiligencia) {
        descDiligencia += `. Observação: ${data.especificacaoDiligencia}`
      }
      return descDiligencia

    case 'JULGADO':
      let descJulgado = `Processo julgado`
      if (data.tipoDecisao) {
        descJulgado += ` - Resultado: ${data.tipoDecisao}`
      }
      if (data.definirAcordo) {
        descJulgado += ` (Acordo Firmado)`
      }
      if (data.votos && data.votos.length > 0) {
        descJulgado += `. Votação registrada com ${data.votos.length} voto(s)`
      }
      return descJulgado

    default:
      return `Decisão registrada: ${data.tipoResultado}`
  }
}

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

const atualizarDecisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  tipoResultado: z.enum(['SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'JULGADO'], {
    required_error: 'Tipo de resultado é obrigatório'
  }),
  // Para JULGADO
  tipoDecisao: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  // Para todos (opcional)
  observacoes: z.string().optional(),
  // Para SUSPENSO
  motivoSuspensao: z.string().optional(),
  // Para PEDIDO_VISTA
  conselheiroPedidoVista: z.string().optional(),
  prazoVista: z.string().optional(),
  // Para PEDIDO_DILIGENCIA
  especificacaoDiligencia: z.string().optional(),
  prazoDiligencia: z.string().optional(),
  // Para acordos
  definirAcordo: z.boolean().optional(),
  tipoAcordo: z.enum(['aceita_proposta', 'contra_proposta', 'sem_acordo']).optional(),
  // Texto da ata específico do processo
  ataTexto: z.string().min(1, 'Texto da ata é obrigatório'),
  // Votos
  votos: z.array(votoSchema).optional()
}).superRefine((data, ctx) => {
  // Validações específicas por tipo de resultado
  if (data.tipoResultado === 'PEDIDO_DILIGENCIA') {
    if (!data.prazoDiligencia || data.prazoDiligencia.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prazo para cumprimento é obrigatório',
        path: ['prazoDiligencia']
      })
    }
  }

  if (data.tipoResultado === 'PEDIDO_VISTA') {
    if (!data.conselheiroPedidoVista || data.conselheiroPedidoVista.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conselheiro que pediu vista é obrigatório',
        path: ['conselheiroPedidoVista']
      })
    }
  }
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decisaoId: string }> }
) {
  try {
    const { id, decisaoId } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin e Funcionário podem atualizar decisões
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar decisões' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = atualizarDecisaoSchema.safeParse(body)

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

    // Verificar se a decisão existe e pertence à sessão
    const decisaoExistente = await prisma.decisao.findUnique({
      where: { id: decisaoId },
      include: {
        sessao: {
          include: {
            pauta: {
              include: {
                processos: {
                  include: {
                    processo: true
                  }
                }
              }
            }
          }
        },
        votos: true
      }
    })

    if (!decisaoExistente || decisaoExistente.sessaoId !== id) {
      return NextResponse.json(
        { error: 'Decisão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a sessão está ativa
    if (decisaoExistente.sessao.dataFim) {
      return NextResponse.json(
        { error: 'Não é possível atualizar decisões de sessões finalizadas' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe na pauta
    const processoNaPauta = decisaoExistente.sessao.pauta.processos.find(
      p => p.processo.id === data.processoId
    )

    if (!processoNaPauta) {
      return NextResponse.json(
        { error: 'Processo não encontrado na pauta desta sessão' },
        { status: 400 }
      )
    }

    // Validação específica para PEDIDO_VISTA
    if (data.tipoResultado === 'PEDIDO_VISTA' && data.conselheiroPedidoVista) {
      const relatorAtual = processoNaPauta.relator
      const revisoresAtuais = processoNaPauta.revisores || []

      if (relatorAtual && data.conselheiroPedidoVista === relatorAtual) {
        return NextResponse.json(
          { error: `O relator "${relatorAtual}" não pode pedir vista do próprio processo. Selecione outro conselheiro.` },
          { status: 400 }
        )
      }

      if (revisoresAtuais.includes(data.conselheiroPedidoVista)) {
        return NextResponse.json(
          { error: `O revisor "${data.conselheiroPedidoVista}" não pode pedir vista do próprio processo. Selecione outro conselheiro.` },
          { status: 400 }
        )
      }
    }

    // Usar transação para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar a decisão
      const decisaoAtualizada = await tx.decisao.update({
        where: { id: decisaoId },
        data: {
          tipoResultado: data.tipoResultado,
          tipoDecisao: data.tipoResultado === 'JULGADO' ? (data.tipoDecisao || null) : null,
          observacoes: data.observacoes || '',
          motivoSuspensao: data.motivoSuspensao || null,
          conselheiroPedidoVista: data.conselheiroPedidoVista || null,
          prazoVista: data.prazoVista ? new Date(data.prazoVista) : null,
          especificacaoDiligencia: data.especificacaoDiligencia || null,
          prazoDiligencia: data.prazoDiligencia ? parseInt(data.prazoDiligencia) : null,
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

      // Remover votos existentes e criar novos se fornecidos
      await tx.voto.deleteMany({
        where: { decisaoId: decisaoId }
      })

      if (data.votos && data.votos.length > 0) {
        await tx.voto.createMany({
          data: data.votos.map(voto => ({
            decisaoId: decisaoId,
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
          prazoDiligencia: data.prazoDiligencia ? parseInt(data.prazoDiligencia) : null,
          observacoesSessao: data.observacoes
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
            novoStatusProcesso = 'ACORDO_FIRMADO'
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

      // Remover histórico anterior relacionado a esta decisão
      await tx.historicoProcesso.deleteMany({
        where: {
          processoId: data.processoId,
          tipo: 'DECISAO',
          createdAt: {
            gte: decisaoExistente.createdAt,
            lte: new Date(decisaoExistente.createdAt.getTime() + 5000) // 5 segundos de margem
          }
        }
      })

      // Adicionar novo histórico do processo
      const tituloHistorico = getTituloHistoricoDecisao(data.tipoResultado)
      const descricaoHistorico = getDescricaoHistoricoDecisao(data, decisaoAtualizada)

      await tx.historicoProcesso.create({
        data: {
          processoId: data.processoId,
          usuarioId: user.id,
          titulo: `${tituloHistorico}`,
          descricao: descricaoHistorico,
          tipo: 'DECISAO'
        }
      })

      return decisaoAtualizada
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Decisao',
        entidadeId: decisaoId,
        dadosAnteriores: {
          processoNumero: processoNaPauta.processo.numero,
          contribuinte: result.processo.contribuinte.nome,
          resultadoAnterior: decisaoExistente.tipoResultado,
          decisaoAnterior: decisaoExistente.tipoDecisao,
          observacoesAnterior: decisaoExistente.observacoes,
          votosAnterior: decisaoExistente.votos.length
        },
        dadosNovos: {
          sessaoId: id,
          processoNumero: processoNaPauta.processo.numero,
          contribuinte: result.processo.contribuinte.nome,
          novoResultado: result.tipoResultado,
          novaDecisao: result.tipoDecisao,
          novaFundamentacao: result.observacoes,
          definirAcordo: result.definirAcordo,
          novosVotos: data.votos?.length || 0,
          alteracao: `${decisaoExistente.tipoResultado} → ${result.tipoResultado}${result.tipoDecisao ? ` (${result.tipoDecisao})` : ''}`
        }
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao atualizar decisão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; decisaoId: string }> }
) {
  try {
    const { id, decisaoId } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin pode excluir decisões
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Apenas administradores podem excluir decisões' },
        { status: 403 }
      )
    }

    // Verificar se a decisão existe e pertence à sessão
    const decisaoExistente = await prisma.decisao.findUnique({
      where: { id: decisaoId },
      include: {
        sessao: {
          include: {
            pauta: {
              include: {
                processos: {
                  include: {
                    processo: true
                  }
                }
              }
            }
          }
        },
        processo: {
          include: {
            contribuinte: true
          }
        },
        votos: true
      }
    })

    if (!decisaoExistente || decisaoExistente.sessaoId !== id) {
      return NextResponse.json(
        { error: 'Decisão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a sessão está ativa
    if (decisaoExistente.sessao.dataFim) {
      return NextResponse.json(
        { error: 'Não é possível excluir decisões de sessões finalizadas' },
        { status: 400 }
      )
    }

    // Encontrar o processo na pauta
    const processoNaPauta = decisaoExistente.sessao.pauta.processos.find(
      p => p.processo.id === decisaoExistente.processoId
    )

    // Usar transação para garantir consistência
    await prisma.$transaction(async (tx) => {
      // Excluir votos primeiro
      await tx.voto.deleteMany({
        where: { decisaoId: decisaoId }
      })

      // Excluir a decisão
      await tx.decisao.delete({
        where: { id: decisaoId }
      })

      // Resetar status do ProcessoPauta
      if (processoNaPauta) {
        await tx.processoPauta.updateMany({
          where: {
            processoId: decisaoExistente.processoId,
            pauta: {
              sessao: {
                id: id
              }
            }
          },
          data: {
            statusSessao: null,
            ataTexto: null,
            motivoSuspensao: null,
            prazoVista: null,
            prazoDialigencia: null,
            observacoesSessao: null
          }
        })
      }

      // Resetar status do processo para EM_SESSAO
      await tx.processo.update({
        where: { id: decisaoExistente.processoId },
        data: { status: 'EM_SESSAO' as any }
      })

      // Remover histórico relacionado a esta decisão
      await tx.historicoProcesso.deleteMany({
        where: {
          processoId: decisaoExistente.processoId,
          tipo: 'DECISAO',
          createdAt: {
            gte: decisaoExistente.createdAt,
            lte: new Date(decisaoExistente.createdAt.getTime() + 5000) // 5 segundos de margem
          }
        }
      })

      // Adicionar histórico de remoção da decisão
      await tx.historicoProcesso.create({
        data: {
          processoId: decisaoExistente.processoId,
          usuarioId: user.id,
          titulo: 'Decisão Removida',
          descricao: `Decisão de ${decisaoExistente.tipoResultado.toLowerCase()} foi removida da sessão de julgamento`,
          tipo: 'DECISAO'
        }
      })
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Decisao',
        entidadeId: decisaoId,
        dadosAnteriores: {
          sessaoId: id,
          processoNumero: decisaoExistente.processo.numero,
          contribuinte: decisaoExistente.processo.contribuinte.nome,
          resultadoExcluido: decisaoExistente.tipoResultado,
          decisaoExcluida: decisaoExistente.tipoDecisao,
          observacoesExcluida: decisaoExistente.observacoes,
          votosExcluidos: decisaoExistente.votos.length,
          exclusao: `Decisão ${decisaoExistente.tipoResultado}${decisaoExistente.tipoDecisao ? ` (${decisaoExistente.tipoDecisao})` : ''} foi removida`
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir decisão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}