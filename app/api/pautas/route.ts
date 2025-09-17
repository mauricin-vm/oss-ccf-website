import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { pautaSchema } from '@/lib/validations/pauta'
import { SessionUser, PrismaWhereFilter } from '@/types'
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const ano = searchParams.get('ano')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const where: PrismaWhereFilter = {}
    if (search) {
      where.numero = { contains: search, mode: 'insensitive' }
    }
    if (status) {
      where.status = status
    }
    if (ano) {
      const startDate = new Date(`${ano}-01-01`)
      const endDate = new Date(`${ano}-12-31`)
      where.dataPauta = {
        gte: startDate,
        lte: endDate
      }
    }
    const [pautas, total] = await Promise.all([
      prisma.pauta.findMany({
        where,
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
          },
          sessao: {
            include: {
              decisoes: true,
              conselheiros: {
                select: {
                  id: true,
                  nome: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: { dataPauta: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.pauta.count({ where })
    ])
    return NextResponse.json({
      pautas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar pautas:', error)
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
    // Apenas Admin e Funcionário podem criar pautas
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar pautas' },
        { status: 403 }
      )
    }
    const body = await request.json()
    // Converter dataPauta para Date
    if (body.dataPauta) {
      body.dataPauta = new Date(body.dataPauta)
    }
    const validationResult = pautaSchema.safeParse(body)
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
    // Verificar se o número da pauta já existe
    const existingPauta = await prisma.pauta.findUnique({
      where: { numero: data.numero }
    })
    if (existingPauta) {
      return NextResponse.json(
        { error: 'Número de pauta já existe' },
        { status: 400 }
      )
    }
    // Verificar se todos os processos existem e estão elegíveis
    const processosIds = data.processos.map(p => p.processoId)
    const processos = await prisma.processo.findMany({
      where: { id: { in: processosIds } },
      include: { contribuinte: true }
    })
    if (processos.length !== processosIds.length) {
      return NextResponse.json(
        { error: 'Um ou mais processos não foram encontrados' },
        { status: 400 }
      )
    }
    // Buscar histórico de distribuição para cada processo
    const processosComDistribuicao = await Promise.all(
      data.processos.map(async (processoPauta) => {
        const ultimaDistribuicao = await prisma.processoPauta.findFirst({
          where: { processoId: processoPauta.processoId },
          include: { pauta: true },
          orderBy: { pauta: { dataPauta: 'desc' } }
        })
        let relator = processoPauta.relator
        let distribuidoPara = processoPauta.relator
        let revisores: string[] = []
        if (ultimaDistribuicao) {
          // Se existe histórico, manter o relator original
          relator = ultimaDistribuicao.relator || processoPauta.relator
          revisores = [...(ultimaDistribuicao.revisores || [])]
          // Se o conselheiro escolhido não é relator nem revisor existente, adiciona aos revisores
          if (processoPauta.relator !== relator && !revisores.includes(processoPauta.relator)) {
            revisores = [...revisores, processoPauta.relator]
          }
          distribuidoPara = processoPauta.relator
        }
        return {
          processoId: processoPauta.processoId,
          ordem: processoPauta.ordem,
          relator,
          distribuidoPara,
          revisores
        }
      })
    )
    // Criar a pauta
    const pauta = await prisma.pauta.create({
      data: {
        numero: data.numero,
        dataPauta: data.dataPauta,
        status: 'aberta',
        observacoes: data.observacoes,
        processos: {
          create: processosComDistribuicao
        }
      },
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
    })
    // Atualizar status dos processos para EM_PAUTA e criar histórico
    await Promise.all([
      // Atualizar status dos processos
      prisma.processo.updateMany({
        where: { id: { in: processosIds } },
        data: { status: 'EM_PAUTA' }
      }),
      // Criar histórico para cada processo
      ...processosComDistribuicao.map((processoPauta) => {
        const distribucaoInfo = processoPauta.distribuidoPara ? ` - Distribuído para: ${processoPauta.distribuidoPara}` : ''
        return prisma.historicoProcesso.create({
          data: {
            processoId: processoPauta.processoId,
            usuarioId: user.id,
            titulo: 'Processo incluído em pauta',
            descricao: `Processo incluído na ${data.numero} agendada para ${data.dataPauta.toLocaleDateString('pt-BR')}${distribucaoInfo}`,
            tipo: 'PAUTA'
          }
        })
      }),
      // Criar tramitações para cada processo na pauta (apenas se houver distribuição)
      ...processosComDistribuicao
        .filter(processoPauta => processoPauta.distribuidoPara) // Só criar tramitação se houver distribuição
        .map((processoPauta) => {
          return prisma.tramitacao.create({
            data: {
              processoId: processoPauta.processoId,
              usuarioId: user.id,
              setorOrigem: 'CCF',
              setorDestino: processoPauta.distribuidoPara, // Nome da pessoa (conselheiro)
              // Remover dataRecebimento - tramitação não deve ser marcada como concluída automaticamente
              observacoes: `Processo distribuído na ${data.numero} para julgamento em ${data.dataPauta.toLocaleDateString('pt-BR')}${processoPauta.revisores.length > 0 ? ` - Revisores: ${processoPauta.revisores.join(', ')}` : ''}`
            }
          })
        })
    ])
    // Criar histórico inicial da pauta
    await prisma.historicoPauta.create({
      data: {
        pautaId: pauta.id,
        usuarioId: user.id,
        titulo: 'Pauta criada',
        descricao: `Pauta ${data.numero} criada com ${data.processos.length} processo${data.processos.length !== 1 ? 's' : ''} para julgamento em ${data.dataPauta.toLocaleDateString('pt-BR')}`,
        tipo: 'CRIACAO'
      }
    })
    // Criar histórico para cada processo adicionado
    if (processosComDistribuicao.length > 0) {
      await Promise.all(
        processosComDistribuicao.map((processoPauta) => {
          const processo = processos.find(p => p.id === processoPauta.processoId)
          const distribucaoInfo = processoPauta.distribuidoPara ? ` - Distribuído para: ${processoPauta.distribuidoPara}` : ''
          return prisma.historicoPauta.create({
            data: {
              pautaId: pauta.id,
              usuarioId: user.id,
              titulo: 'Processo adicionado',
              descricao: `Processo ${processo?.numero} incluído na pauta${distribucaoInfo}`,
              tipo: 'PROCESSO_ADICIONADO'
            }
          })
        })
      )
    }
    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Pauta',
        entidadeId: pauta.id,
        dadosNovos: {
          numero: pauta.numero,
          dataPauta: pauta.dataPauta,
          totalProcessos: processosComDistribuicao.length,
          processos: processos.map(p => ({
            numero: p.numero,
            contribuinte: p.contribuinte.nome
          }))
        }
      }
    })
    return NextResponse.json(pauta, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pauta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}