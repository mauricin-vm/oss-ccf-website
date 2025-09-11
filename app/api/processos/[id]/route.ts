import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { processoSchema } from '@/lib/validations/processo'
import { SessionUser } from '@/types'

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
    const processo = await prisma.processo.findUnique({
      where: { id },
      include: {
        contribuinte: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        tramitacoes: {
          include: {
            usuario: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        documentos: {
          orderBy: { createdAt: 'desc' }
        },
        pautas: {
          include: {
            pauta: true
          },
          orderBy: { pauta: { dataPauta: 'desc' } }
        },
        decisoes: {
          include: {
            sessao: true
          },
          orderBy: { dataDecisao: 'desc' }
        },
        acordo: {
          include: {
            parcelas: {
              orderBy: { numero: 'asc' }
            }
          }
        },
        imoveis: {
          include: {
            imovel: true
          }
        },
        creditos: {
          include: {
            credito: true
          }
        }
      }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Buscar históricos separadamente usando query raw
    let historicos = []
    try {
      historicos = await prisma.$queryRaw`
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
      
      historicos = historicos.map(h => ({
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
    } catch (error) {
      console.log('Error fetching historicos:', error)
      historicos = []
    }

    // Converter campos Decimal para números antes de enviar para o cliente
    const processData = {
      ...processo,
      valorOriginal: processo.valorOriginal ? Number(processo.valorOriginal) : null,
      valorNegociado: processo.valorNegociado ? Number(processo.valorNegociado) : null,
      historicos,
      acordo: processo.acordo ? {
        ...processo.acordo,
        valorTotal: Number(processo.acordo.valorTotal),
        parcelas: processo.acordo.parcelas.map(parcela => ({
          ...parcela,
          valor: Number(parcela.valor)
        }))
      } : null
    }

    return NextResponse.json({ processo: processData })
  } catch (error) {
    console.error('Erro ao buscar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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

    // Apenas Admin e Funcionário podem editar processos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar processos' },
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
    
    // Buscar processo atual para auditoria
    const processoAtual = await prisma.processo.findUnique({
      where: { id },
      include: { contribuinte: true }
    })

    if (!processoAtual) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o número do processo já existe em outro processo
    if (processoData.numero !== processoAtual.numero) {
      const processoComMesmoNumero = await prisma.processo.findFirst({
        where: { 
          numero: processoData.numero,
          id: { not: id }
        }
      })

      if (processoComMesmoNumero) {
        return NextResponse.json(
          { error: 'Número de processo já existe' },
          { status: 400 }
        )
      }
    }

    // Atualizar contribuinte
    const contribuinteUpdateData = {
      ...contribuinteData
    }
    
    // Só incluir cpfCnpj se tiver valor
    if (contribuinteData.cpfCnpj) {
      contribuinteUpdateData.cpfCnpj = contribuinteData.cpfCnpj.replace(/\D/g, '')
    }
    
    await prisma.contribuinte.update({
      where: { id: processoAtual.contribuinteId },
      data: contribuinteUpdateData
    })

    // Atualizar o processo
    const processoAtualizado = await prisma.processo.update({
      where: { id },
      data: {
        ...processoData,
        valorOriginal: processoData.valorOriginal || 0,
        valorNegociado: processoData.valorNegociado || null,
        updatedAt: new Date()
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

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'Processo',
        entidadeId: id,
        dadosAnteriores: {
          numero: processoAtual.numero,
          tipo: processoAtual.tipo,
          status: processoAtual.status,
          valorOriginal: processoAtual.valorOriginal,
          valorNegociado: processoAtual.valorNegociado,
          observacoes: processoAtual.observacoes
        },
        dadosNovos: {
          numero: processoAtualizado.numero,
          tipo: processoAtualizado.tipo,
          status: processoAtualizado.status,
          valorOriginal: processoAtualizado.valorOriginal,
          valorNegociado: processoAtualizado.valorNegociado,
          observacoes: processoAtualizado.observacoes
        }
      }
    })

    // Converter valores Decimal para number antes de retornar
    const processoAtualizadoSerializado = {
      ...processoAtualizado,
      valorOriginal: processoAtualizado.valorOriginal ? Number(processoAtualizado.valorOriginal) : null,
      valorNegociado: processoAtualizado.valorNegociado ? Number(processoAtualizado.valorNegociado) : null
    }

    return NextResponse.json(processoAtualizadoSerializado)
  } catch (error) {
    console.error('Erro ao atualizar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Apenas Admin pode deletar processos
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar processos' },
        { status: 403 }
      )
    }

    const processo = await prisma.processo.findUnique({
      where: { id }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se pode ser deletado (apenas processos em status inicial)
    if (!['RECEPCIONADO', 'EM_ANALISE'].includes(processo.status)) {
      return NextResponse.json(
        { error: 'Não é possível deletar processos que já estão em andamento' },
        { status: 400 }
      )
    }

    await prisma.processo.delete({
      where: { id }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Processo',
        entidadeId: id,
        dadosAnteriores: {
          numero: processo.numero,
          tipo: processo.tipo,
          status: processo.status
        }
      }
    })

    return NextResponse.json({ message: 'Processo deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}