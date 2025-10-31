import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { SessionUser } from '@/types'

type StatusProcesso = 'RECEPCIONADO' | 'EM_ANALISE' | 'AGUARDANDO_DOCUMENTOS' | 'EM_PAUTA' | 'JULGADO' | 'EM_CUMPRIMENTO' | 'FINALIZADO' | 'CONCLUIDO' | 'SUSPENSO' | 'PEDIDO_VISTA' | 'PEDIDO_DILIGENCIA' | 'EM_NEGOCIACAO'
// Funções auxiliares para histórico
function getTituloHistoricoDecisao(tipoResultado: string): string {
  switch (tipoResultado) {
    case 'SUSPENSO': return 'Processo Suspenso'
    case 'PEDIDO_VISTA': return 'Pedido de Vista'
    case 'PEDIDO_DILIGENCIA': return 'Pedido de Diligência'
    case 'EM_NEGOCIACAO': return 'Processo em Negociação'
    case 'JULGADO': return 'Processo Julgado'
    default: return 'Decisão Registrada'
  }
}
function getDescricaoHistoricoDecisao(data: Record<string, unknown>): string {
  switch (data.tipoResultado) {
    case 'SUSPENSO':
      let descSuspenso = (data.ataTexto as string) || 'Texto da ata não informado'
      if (data.observacoes) {
        descSuspenso += `\n\nObservação: ${data.observacoes}`
      }
      return descSuspenso
    case 'PEDIDO_VISTA':
      let descVista = (data.ataTexto as string) || 'Texto da ata não informado'
      if (data.observacoes) {
        descVista += `\n\nObservação: ${data.observacoes}`
      }
      return descVista
    case 'PEDIDO_DILIGENCIA':
      let descDiligencia = (data.ataTexto as string) || 'Texto da ata não informado'
      if (data.observacoes) {
        descDiligencia += `\n\nObservação: ${data.observacoes}`
      }
      return descDiligencia
    case 'EM_NEGOCIACAO':
      let descNegociacao = (data.ataTexto as string) || 'Texto da ata não informado'
      if (data.detalhesNegociacao) {
        descNegociacao += `\n\nDetalhes da Negociação: ${data.detalhesNegociacao}`
      }
      if (data.observacoes) {
        descNegociacao += `\n\nObservação: ${data.observacoes}`
      }
      return descNegociacao
    case 'JULGADO':
      let descJulgado = (data.ataTexto as string) || 'Texto da ata não informado'
      if (data.observacoes) {
        descJulgado += `\n\nObservação: ${data.observacoes}`
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
  posicaoVoto: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL', 'ABSTENCAO', 'AUSENTE', 'IMPEDIDO']).optional(),
  acompanhaVoto: z.string().optional(),
  ordemApresentacao: z.number().optional(),
  isPresidente: z.boolean().optional()
})
const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  tipoResultado: z.enum(['SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'EM_NEGOCIACAO', 'JULGADO']).refine(val => ['SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'EM_NEGOCIACAO', 'JULGADO'].includes(val), {
    message: 'Tipo de resultado é obrigatório'
  }),
  // Para JULGADO
  tipoDecisao: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  // Para todos (opcional)
  observacoes: z.string().optional(),
  // Para SUSPENSO
  motivoSuspensao: z.string().optional(),
  // Para EM_NEGOCIACAO
  detalhesNegociacao: z.string().optional(),
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
  ataTexto: z.string().min(1, 'Texto da ata é obrigatório'),
  // Votos
  votos: z.array(votoSchema).optional(),
  // Presidente Substituto (em caso de conflito de interesse)
  presidenteSubstitutoId: z.string().optional()
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
          details: validationResult.error.issues
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
    const processoNaPauta = sessao.pauta?.processos.find(
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
    // Validação específica para PEDIDO_VISTA
    if (data.tipoResultado === 'PEDIDO_VISTA' && data.conselheiroPedidoVista) {
      // Verificar se quem está pedindo vista não é o relator atual
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
      // Criar a decisão
      const decisao = await tx.decisao.create({
        data: {
          sessaoId: id,
          processoId: data.processoId,
          tipoResultado: data.tipoResultado,
          tipoDecisao: data.tipoResultado === 'JULGADO' ? (data.tipoDecisao || null) : null,
          observacoes: data.observacoes || '',
          motivoSuspensao: data.motivoSuspensao || null,
          detalhesNegociacao: data.detalhesNegociacao || null,
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
      // Criar votos se fornecidos (todos os votos para preservar informações de auditoria)
      if (data.votos && data.votos.length > 0) {
        await tx.voto.createMany({
          data: data.votos.map(voto => ({
            decisaoId: decisao.id,
            conselheiroId: voto.conselheiroId || null,
            tipoVoto: voto.tipoVoto,
            nomeVotante: voto.nomeVotante,
            textoVoto: voto.textoVoto || null,
            posicaoVoto: voto.posicaoVoto as 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' | 'ABSTENCAO' | 'AUSENTE' | 'IMPEDIDO' || null,
            acompanhaVoto: voto.acompanhaVoto || null,
            ordemApresentacao: voto.ordemApresentacao || null,
            isPresidente: voto.isPresidente || false
          }))
        })
      }
      // Atualizar ProcessoPauta com informações específicas da sessão
      const updateData: Record<string, unknown> = {
        statusSessao: data.tipoResultado,
        ataTexto: data.ataTexto || null,
        motivoSuspensao: data.motivoSuspensao || null,
        prazoVista: data.prazoVista ? new Date(data.prazoVista) : null,
        prazoDiligencia: data.prazoDiligencia ? parseInt(data.prazoDiligencia) : null,
        observacoesSessao: data.observacoes,
        presidenteSubstitutoId: data.presidenteSubstitutoId || null
      }
      // Atualizar revisores baseado no tipo de resultado
      if (data.tipoResultado === 'PEDIDO_VISTA' && data.conselheiroPedidoVista) {
        // Para pedido de vista, adicionar o conselheiro aos revisores
        const processoPautaAtual = await tx.processoPauta.findFirst({
          where: {
            processoId: data.processoId,
            pauta: {
              sessao: {
                id: id
              }
            }
          }
        })
        if (processoPautaAtual) {
          const revisoresAtuais = processoPautaAtual.revisores || []
          // Adicionar o novo revisor se não estiver já na lista
          if (!revisoresAtuais.includes(data.conselheiroPedidoVista)) {
            updateData.revisores = [...revisoresAtuais, data.conselheiroPedidoVista]
          }
        }
      } else if (data.votos && data.votos.length > 0) {
        // Para qualquer resultado com votos, extrair revisores dos votos registrados
        const revisoresDoVoto = data.votos
          .filter((voto: Record<string, unknown>) => voto.tipoVoto === 'REVISOR')
          .map((voto: Record<string, unknown>) => voto.nomeVotante)
        if (revisoresDoVoto.length > 0) {
          // Buscar o registro atual para manter revisores existentes
          const processoPautaAtual = await tx.processoPauta.findFirst({
            where: {
              processoId: data.processoId,
              pauta: {
                sessao: {
                  id: id
                }
              }
            }
          })
          if (processoPautaAtual) {
            const revisoresAtuais = processoPautaAtual.revisores || []
            // Combinar revisores existentes com os novos (sem duplicatas)
            const todosRevisores = [...new Set([...revisoresAtuais, ...revisoresDoVoto])]
            updateData.revisores = todosRevisores
          } else {
            updateData.revisores = revisoresDoVoto
          }
        }
      }
      await tx.processoPauta.updateMany({
        where: {
          processoId: data.processoId,
          pauta: {
            sessao: {
              id: id
            }
          }
        },
        data: updateData
      })
      // Atualizar status do processo baseado no resultado
      let novoStatusProcesso: StatusProcesso
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
        case 'EM_NEGOCIACAO':
          novoStatusProcesso = 'EM_NEGOCIACAO'
          break
        case 'JULGADO':
          if (data.definirAcordo) {
            novoStatusProcesso = 'EM_CUMPRIMENTO'
          } else {
            novoStatusProcesso = 'JULGADO'
          }
          break
        default:
          novoStatusProcesso = 'JULGADO'
      }
      await tx.processo.update({
        where: { id: data.processoId },
        data: { status: novoStatusProcesso }
      })
      // Adicionar histórico do processo
      const tituloHistorico = getTituloHistoricoDecisao(data.tipoResultado)
      const descricaoHistorico = getDescricaoHistoricoDecisao(data)
      await tx.historicoProcesso.create({
        data: {
          processoId: data.processoId,
          usuarioId: user.id,
          titulo: tituloHistorico,
          descricao: descricaoHistorico,
          tipo: 'DECISAO'
        }
      })
      return decisao
    })
    const decisao = result
    // Verificar se todos os processos foram julgados
    const totalProcessos = sessao.pauta?.processos.length || 0
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
          resultadoDecisao: decisao.tipoResultado,
          tipoDecisao: decisao.tipoDecisao,
          observacoes: decisao.observacoes,
          definirAcordo: decisao.definirAcordo,
          progressoSessao: `${totalDecisoes}/${totalProcessos}`,
          votosRegistrados: data.votos?.length || 0,
          decisaoCompleta: `${decisao.tipoResultado}${decisao.tipoDecisao ? ` (${decisao.tipoDecisao})` : ''}${decisao.definirAcordo ? ' - Acordo Firmado' : ''}`
        }
      }
    })

    // Revalidar a página de detalhes da sessão para mostrar a decisão adicionada
    revalidatePath(`/sessoes/${id}`)

    return NextResponse.json(decisao, { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar decisão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}