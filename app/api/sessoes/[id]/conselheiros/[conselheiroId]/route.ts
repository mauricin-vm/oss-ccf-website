import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, conselheiroId: string }> }
) {
  try {
    const { id, conselheiroId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin e Funcionário podem editar sessões
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para editar sessões' },
        { status: 403 }
      )
    }

    // Buscar sessão atual
    const sessaoAtual = await prisma.sessaoJulgamento.findUnique({
      where: { id },
      include: {
        conselheiros: true
      }
    })

    if (!sessaoAtual) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a sessão pode ser editada (apenas sessões não finalizadas)
    if (sessaoAtual.dataFim) {
      return NextResponse.json(
        { error: 'Sessões finalizadas não podem ser editadas' },
        { status: 400 }
      )
    }

    // Verificar se o conselheiro está realmente na sessão
    const conselheiroNaSessao = sessaoAtual.conselheiros.find(c => c.id === conselheiroId)
    if (!conselheiroNaSessao) {
      return NextResponse.json(
        { error: 'Conselheiro não está participando desta sessão' },
        { status: 404 }
      )
    }

    // Remover o conselheiro da sessão
    await prisma.sessaoJulgamento.update({
      where: { id },
      data: {
        conselheiros: {
          disconnect: { id: conselheiroId }
        },
        updatedAt: new Date()
      }
    })

    // Log de auditoria
    await prisma.logAuditoria.create({
      data: {
        usuarioId: user.id,
        acao: 'UPDATE',
        entidade: 'SessaoJulgamento',
        entidadeId: id,
        dadosAnteriores: {
          conselheiros: sessaoAtual.conselheiros.map(c => c.id)
        },
        dadosNovos: {
          conselheiros: sessaoAtual.conselheiros.filter(c => c.id !== conselheiroId).map(c => c.id),
          motivoRemocao: 'Conselheiro selecionado como presidente'
        }
      }
    })

    return NextResponse.json({ 
      message: 'Conselheiro removido da sessão com sucesso' 
    })
  } catch (error) {
    console.error('Erro ao remover conselheiro da sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}