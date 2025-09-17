import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    if (user.role !== 'ADMIN' && user.role !== 'FUNCIONARIO') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const resolvedParams = await params
    const { atualizarProcesso } = await request.json()

    // Buscar o acordo
    const acordo = await prisma.acordo.findUnique({
      where: { id: resolvedParams.id },
      include: {
        processo: true
      }
    })

    if (!acordo) {
      return NextResponse.json({ error: 'Acordo não encontrado' }, { status: 404 })
    }

    // Verificar se o acordo pode ser concluído
    if (acordo.status !== 'ativo') {
      return NextResponse.json({ error: 'Apenas acordos ativos podem ser concluídos' }, { status: 400 })
    }

    // Verificar se é um tipo de acordo que permite conclusão direta (compensação ou dação)
    const tipoProcesso = acordo.processo.tipo
    if (tipoProcesso !== 'COMPENSACAO' && tipoProcesso !== 'DACAO_PAGAMENTO') {
      return NextResponse.json({
        error: 'Este tipo de acordo não pode ser concluído diretamente'
      }, { status: 400 })
    }

    const agora = new Date()

    // Atualizar o acordo
    const acordoAtualizado = await prisma.acordo.update({
      where: { id: resolvedParams.id },
      data: {
        status: 'cumprido'
      }
    })

    // Criar histórico do processo
    await prisma.historicoProcesso.create({
      data: {
        processoId: acordo.processoId,
        titulo: 'Acordo Concluído',
        descricao: `Acordo ${tipoProcesso === 'COMPENSACAO' ? 'de compensação' : 'de dação em pagamento'} concluído`,
        tipo: 'ACORDO_CONCLUIDO',
        usuarioId: user.id
      }
    })

    // Atualizar status do processo se solicitado
    if (atualizarProcesso) {
      await prisma.processo.update({
        where: { id: acordo.processoId },
        data: {
          status: 'CONCLUIDO'
        }
      })

      // Criar histórico adicional para o processo
      await prisma.historicoProcesso.create({
        data: {
          processoId: acordo.processoId,
          titulo: 'Processo Concluído',
          descricao: 'Processo concluído através da conclusão do acordo',
          tipo: 'PROCESSO_CONCLUIDO',
          usuarioId: user.id
        }
      })
    }

    // Registrar log da atividade
    await prisma.logAuditoria.create({
      data: {
        acao: 'ACORDO_CONCLUIDO',
        entidade: 'Acordo',
        entidadeId: acordo.id,
        dadosAnteriores: {
          status: 'ativo'
        },
        dadosNovos: {
          status: 'cumprido',
          dataConclusao: agora,
          processoNumero: acordo.processo.numero,
          tipoProcesso: tipoProcesso,
          valorFinal: acordo.valorFinal,
          atualizouProcesso: atualizarProcesso
        },
        usuarioId: user.id
      }
    })

    return NextResponse.json({
      message: 'Acordo concluído com sucesso',
      acordo: acordoAtualizado
    })

  } catch (error) {
    console.error('Erro ao concluir acordo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}