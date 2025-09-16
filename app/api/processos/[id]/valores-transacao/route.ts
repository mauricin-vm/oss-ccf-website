import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { SessionUser } from '@/types'
import { z } from 'zod'

const debitoSchema = z.object({
  descricao: z.string().min(1),
  valor: z.number().min(0.01),
  dataVencimento: z.string().min(1)
})

const inscricaoSchema = z.object({
  numeroInscricao: z.string().min(1),
  tipoInscricao: z.enum(['imobiliaria', 'economica']),
  debitos: z.array(debitoSchema).min(1, 'Pelo menos um débito deve ser informado')
})

const propostaSchema = z.object({
  valorTotalProposto: z.number().min(0.01),
  metodoPagamento: z.enum(['a_vista', 'parcelado']),
  valorEntrada: z.number().min(0),
  quantidadeParcelas: z.number().min(1).max(120).optional()
})

const valoresTransacaoSchema = z.object({
  inscricoes: z.array(inscricaoSchema),
  proposta: propostaSchema
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    if (user.role !== 'ADMIN' && user.role !== 'FUNCIONARIO') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    // Validar dados de entrada
    const validationResult = valoresTransacaoSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { inscricoes, proposta } = validationResult.data

    // Verificar se o processo existe e é do tipo correto
    const processo = await prisma.processo.findUnique({
      where: { id }
    })

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (processo.tipo !== 'TRANSACAO_EXCEPCIONAL') {
      return NextResponse.json({ error: 'Processo não é do tipo Transação Excepcional' }, { status: 400 })
    }

    // Iniciar transação para salvar os dados
    const result = await prisma.$transaction(async (tx) => {
      // Primeiro, remover dados existentes para este processo
      await tx.processoInscricao.deleteMany({
        where: { processoId: id }
      })

      // Remover transação excepcional existente (se houver)
      await tx.transacaoExcepcional.deleteMany({
        where: { processoId: id }
      })

      // Processar cada inscrição a negociar
      for (const inscricaoData of inscricoes) {
        // Criar a inscrição
        const inscricao = await tx.processoInscricao.create({
          data: {
            processoId: id,
            numeroInscricao: inscricaoData.numeroInscricao,
            tipoInscricao: inscricaoData.tipoInscricao
          }
        })

        // Criar os débitos da inscrição
        for (const debitoData of inscricaoData.debitos) {
          await tx.processoDebito.create({
            data: {
              inscricaoId: inscricao.id,
              descricao: debitoData.descricao,
              valor: debitoData.valor,
              dataVencimento: new Date(debitoData.dataVencimento)
            }
          })
        }
      }

      // Calcular valores
      const valorTotalInscricoes = inscricoes.reduce((total, inscricao) => {
        return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
      }, 0)

      const valorDesconto = valorTotalInscricoes - proposta.valorTotalProposto
      const percentualDesconto = valorTotalInscricoes > 0 ? (valorDesconto / valorTotalInscricoes) * 100 : 0

      // Criar registro da transação excepcional
      const transacao = await tx.transacaoExcepcional.create({
        data: {
          processoId: id,
          valorTotalInscricoes,
          valorTotalProposto: proposta.valorTotalProposto,
          valorDesconto,
          percentualDesconto
        }
      })

      // Calcular valor da parcela se for parcelado
      let valorParcela = null
      if (proposta.metodoPagamento === 'parcelado' && proposta.quantidadeParcelas && proposta.quantidadeParcelas > 0) {
        const valorRestante = proposta.valorTotalProposto - proposta.valorEntrada
        valorParcela = valorRestante / proposta.quantidadeParcelas
      }

      // Criar proposta da transação
      await tx.propostaTransacao.create({
        data: {
          transacaoId: transacao.id,
          valorTotalProposto: proposta.valorTotalProposto,
          metodoPagamento: proposta.metodoPagamento === 'a_vista' ? 'A_VISTA' : 'PARCELADO',
          valorEntrada: proposta.valorEntrada,
          quantidadeParcelas: proposta.quantidadeParcelas,
          valorParcela
        }
      })


      return { success: true }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Erro ao salvar valores de transação excepcional:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Buscar valores de transação para o processo
    const processo = await prisma.processo.findUnique({
      where: { id },
      include: {
        inscricoes: {
          include: {
            debitos: true
          }
        },
        transacao: {
          include: {
            proposta: true
          }
        }
      }
    })

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    if (processo.tipo !== 'TRANSACAO_EXCEPCIONAL') {
      return NextResponse.json({ error: 'Processo não é do tipo Transação Excepcional' }, { status: 400 })
    }

    // Proposta padrão se não houver dados salvos
    let proposta = {
      valorTotalProposto: 0,
      metodoPagamento: 'a_vista' as 'a_vista' | 'parcelado',
      valorEntrada: 0,
      quantidadeParcelas: 1,
      valorParcela: 0
    }

    // Se existe transação excepcional salva, usar os dados dela
    if (processo.transacao?.proposta) {
      const propostaSalva = processo.transacao.proposta
      proposta = {
        valorTotalProposto: Number(propostaSalva.valorTotalProposto),
        metodoPagamento: propostaSalva.metodoPagamento.toLowerCase() as 'a_vista' | 'parcelado',
        valorEntrada: Number(propostaSalva.valorEntrada),
        quantidadeParcelas: propostaSalva.quantidadeParcelas || 1,
        valorParcela: Number(propostaSalva.valorParcela || 0)
      }
    }

    // Formatar dados para retorno
    const valoresTransacao = {
      inscricoes: processo.inscricoes.map(inscricao => ({
        id: inscricao.id,
        numeroInscricao: inscricao.numeroInscricao,
        tipoInscricao: inscricao.tipoInscricao,
        debitos: inscricao.debitos.map(debito => ({
          id: debito.id,
          descricao: debito.descricao,
          valor: Number(debito.valor),
          dataVencimento: debito.dataVencimento.toISOString().split('T')[0]
        }))
      })),
      proposta,
      resumo: processo.transacao ? {
        valorTotalInscricoes: Number(processo.transacao.valorTotalInscricoes),
        valorTotalProposto: Number(processo.transacao.valorTotalProposto),
        valorDesconto: Number(processo.transacao.valorDesconto),
        percentualDesconto: Number(processo.transacao.percentualDesconto)
      } : null
    }

    return NextResponse.json(valoresTransacao)

  } catch (error) {
    console.error('Erro ao buscar valores de transação excepcional:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}