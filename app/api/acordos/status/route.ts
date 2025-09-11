import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { atualizarStatusParcelas, gerarRelatorioParcelasVencidas } from '@/lib/utils/parcelas'
import { SessionUser } from '@/types'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Apenas Admin pode executar atualização de status
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar status' },
        { status: 403 }
      )
    }

    const resultado = await atualizarStatusParcelas()

    return NextResponse.json({
      message: 'Status das parcelas atualizado com sucesso',
      ...resultado
    })
  } catch (error) {
    console.error('Erro ao atualizar status das parcelas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const diasVencimento = parseInt(searchParams.get('dias') || '0')
    const acao = searchParams.get('acao')

    if (acao === 'relatorio-vencidas') {
      const relatorio = await gerarRelatorioParcelasVencidas(diasVencimento)
      return NextResponse.json({ parcelasVencidas: relatorio })
    }

    // Executar atualização automática se solicitada
    if (acao === 'atualizar') {
      const resultado = await atualizarStatusParcelas()
      return NextResponse.json({
        message: 'Status atualizado automaticamente',
        ...resultado
      })
    }

    return NextResponse.json({ message: 'Endpoint de status das parcelas' })
  } catch (error) {
    console.error('Erro no endpoint de status:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}