import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { processoSchema } from '@/lib/validations/processo'
import { SessionUser } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const processo = await prisma.processo.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(processo)
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
        valorOriginal: processoData.valorOriginal,
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

    return NextResponse.json(processoAtualizado)
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin pode deletar processos
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar processos' },
        { status: 403 }
      )
    }

    const processo = await prisma.processo.findUnique({
      where: { id: params.id }
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
      where: { id: params.id }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'DELETE',
        entidade: 'Processo',
        entidadeId: params.id,
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