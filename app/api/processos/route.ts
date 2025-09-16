import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { processoSchema } from '@/lib/validations/processo'
import { SessionUser, ProcessoWhereFilter } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const where: ProcessoWhereFilter = {}
    
    if (search) {
      const cleanedSearch = search.replace(/\D/g, '')
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { contribuinte: { nome: { contains: search, mode: 'insensitive' } } }
      ]
      
      // Só adicionar busca por CPF/CNPJ se houver números na busca
      if (cleanedSearch.length > 0) {
        where.OR.push({ contribuinte: { cpfCnpj: { contains: cleanedSearch } } })
      }
    }
    
    if (tipo) {
      where.tipo = tipo
    }
    
    if (status) {
      // Converter string separada por vírgula em array para usar com 'in'
      const statusArray = status.split(',').map(s => s.trim())

      // Validar se os status existem no enum StatusProcesso
      const validStatuses = ['RECEPCIONADO', 'EM_ANALISE', 'EM_PAUTA', 'SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'JULGADO', 'ACORDO_FIRMADO', 'EM_CUMPRIMENTO', 'ARQUIVADO']
      const filteredStatuses = statusArray.filter(s => validStatuses.includes(s))

      if (filteredStatuses.length > 0) {
        where.status = { in: filteredStatuses as any }
      }
    }

    const [processos, total] = await Promise.all([
      prisma.processo.findMany({
        where: where as any,
        include: {
          contribuinte: true,
          tramitacoes: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          acordo: {
            include: {
              parcelas: true
            }
          },
          pautas: {
            include: {
              pauta: {
                select: {
                  id: true,
                  numero: true,
                  dataPauta: true,
                  status: true
                }
              }
            },
            orderBy: {
              pauta: {
                dataPauta: 'desc'
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.processo.count({ where: where as any })
    ])


    // Os processos agora não possuem mais campos de valor, removidos para usar valores específicos
    const processosSerializados = processos

    return NextResponse.json({
      processos: processosSerializados,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Erro ao buscar processos:', error)
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

    // Apenas Admin e Funcionário podem criar processos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para criar processos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = processoSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const { contribuinte: contribuinteData, ...processoData } = validationResult.data

    // Verificar se o número do processo já existe
    const existingProcesso = await prisma.processo.findUnique({
      where: { numero: processoData.numero }
    })

    if (existingProcesso) {
      return NextResponse.json(
        { error: 'Número de processo já existe' },
        { status: 400 }
      )
    }

    // Processar CPF/CNPJ se fornecido
    const cpfCnpjLimpo = contribuinteData.cpfCnpj && contribuinteData.cpfCnpj.trim() !== '' ? 
      contribuinteData.cpfCnpj.replace(/\D/g, '') : null
    
    let contribuinte = null
    
    // Se tem CPF/CNPJ, tentar encontrar contribuinte existente
    if (cpfCnpjLimpo && cpfCnpjLimpo.length > 0) {
      contribuinte = await prisma.contribuinte.findFirst({
        where: { cpfCnpj: cpfCnpjLimpo }
      })
      
      if (contribuinte) {
        // Atualizar dados do contribuinte existente
        const dadosAtualizacao = { 
          nome: contribuinteData.nome,
          email: contribuinteData.email || null,
          telefone: contribuinteData.telefone || null,
          endereco: contribuinteData.endereco || null,
          cidade: contribuinteData.cidade || null,
          estado: contribuinteData.estado || null,
          cep: contribuinteData.cep || null,
          cpfCnpj: cpfCnpjLimpo
        }
        
        contribuinte = await prisma.contribuinte.update({
          where: { id: contribuinte.id },
          data: dadosAtualizacao
        })
      }
    }
    
    // Se não encontrou contribuinte existente, criar novo
    if (!contribuinte) {
      // Criar dados do contribuinte tratando campos vazios
      const dadosContribuinte = {
        nome: contribuinteData.nome,
        email: contribuinteData.email && contribuinteData.email.trim() !== '' ? contribuinteData.email : null,
        telefone: contribuinteData.telefone && contribuinteData.telefone.trim() !== '' ? contribuinteData.telefone : null,
        endereco: contribuinteData.endereco && contribuinteData.endereco.trim() !== '' ? contribuinteData.endereco : null,
        cidade: contribuinteData.cidade && contribuinteData.cidade.trim() !== '' ? contribuinteData.cidade : null,
        estado: contribuinteData.estado && contribuinteData.estado.trim() !== '' ? contribuinteData.estado : null,
        cep: contribuinteData.cep && contribuinteData.cep.trim() !== '' ? contribuinteData.cep : null,
      }
      
      // Só adicionar cpfCnpj se tiver valor
      if (cpfCnpjLimpo && cpfCnpjLimpo.length > 0) {
        dadosContribuinte.cpfCnpj = cpfCnpjLimpo
      }
      
      console.log('Criando contribuinte com dados:', dadosContribuinte)
      
      try {
        contribuinte = await prisma.contribuinte.create({
          data: dadosContribuinte
        })
        console.log('Contribuinte criado com sucesso:', contribuinte.id)
      } catch (error) {
        console.error('Erro ao criar contribuinte:', error)
        throw error
      }
    }

    // Verificar se o contribuinte foi criado
    if (!contribuinte || !contribuinte.id) {
      console.error('Contribuinte não foi criado corretamente:', contribuinte)
      return NextResponse.json(
        { error: 'Erro ao criar contribuinte' },
        { status: 500 }
      )
    }
    
    console.log('Criando processo com contribuinteId:', contribuinte.id)
    console.log('User ID:', user.id)
    console.log('Dados do processo:', {
      ...processoData,
      contribuinteId: contribuinte.id,
      createdById: user.id
    })
    
    // Verificar se o usuário existe
    const usuarioExiste = await prisma.user.findUnique({
      where: { id: user.id }
    })
    
    if (!usuarioExiste) {
      console.error('Usuário não encontrado:', user.id)
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 500 }
      )
    }
    
    console.log('Usuário encontrado:', usuarioExiste.email)
    
    // Criar o processo
    let processo
    try {
      processo = await prisma.processo.create({
        data: {
          ...processoData,
          contribuinteId: contribuinte.id,
          createdById: user.id
        },
        include: {
          contribuinte: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      })
      
      console.log('Processo criado com sucesso:', processo.id)
    } catch (error) {
      console.error('Erro detalhado ao criar processo:', error)
      throw error
    }

    // Criar histórico inicial do processo
    try {
      await prisma.historicoProcesso.create({
        data: {
          processoId: processo.id,
          usuarioId: user.id,
          titulo: 'Processo Criado',
          descricao: `Processo ${processo.numero} foi criado no sistema`,
          tipo: 'SISTEMA'
        }
      })
      console.log('Histórico inicial criado para o processo:', processo.id)
    } catch (error) {
      console.error('Erro ao criar histórico inicial:', error)
      // Não interrompe o fluxo se falhar o histórico
    }


    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'CREATE',
        entidade: 'Processo',
        entidadeId: processo.id,
        dadosNovos: {
          numero: processo.numero,
          tipo: processo.tipo,
          valorOriginal: processo.valorOriginal,
          contribuinte: contribuinte.nome
        }
      }
    })

    // Converter valores Decimal para number antes de retornar
    const processoSerializado = {
      ...processo,
      valorOriginal: processo.valorOriginal ? Number(processo.valorOriginal) : null,
      valorNegociado: processo.valorNegociado ? Number(processo.valorNegociado) : null
    }

    return NextResponse.json(processoSerializado, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}