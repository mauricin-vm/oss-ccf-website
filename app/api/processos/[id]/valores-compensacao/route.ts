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
const creditoSchema = z.object({
  tipo: z.enum(['precatorio', 'credito_tributario', 'alvara_judicial', 'outro']),
  numero: z.string().min(1),
  valor: z.number().min(0.01),
  dataVencimento: z.string().optional(),
  descricao: z.string().optional()
})
const valoresCompensacaoSchema = z.object({
  creditos: z.array(creditoSchema),
  inscricoes: z.array(inscricaoSchema)
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
    const validationResult = valoresCompensacaoSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationResult.error.issues },
        { status: 400 }
      )
    }
    const { creditos, inscricoes } = validationResult.data
    // Verificar se o processo existe e é do tipo correto
    const processo = await prisma.processo.findUnique({
      where: { id }
    })
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }
    if (processo.tipo !== 'COMPENSACAO') {
      return NextResponse.json({ error: 'Processo não é do tipo Compensação' }, { status: 400 })
    }
    // Iniciar transação para salvar os dados
    const result = await prisma.$transaction(async (tx) => {
      // Primeiro, remover valores existentes para este processo
      await tx.processoCredito.deleteMany({
        where: { processoId: id }
      })
      // Remover inscrições existentes
      await tx.processoInscricao.deleteMany({
        where: { processoId: id }
      })
      // Processar cada crédito
      for (const creditoData of creditos) {
        // Verificar se o crédito já existe ou criar um novo
        let credito = await tx.credito.findUnique({
          where: { numero: creditoData.numero }
        })
        if (!credito) {
          // Criar novo crédito
          credito = await tx.credito.create({
            data: {
              tipo: creditoData.tipo,
              numero: creditoData.numero,
              valor: creditoData.valor,
              dataVencimento: creditoData.dataVencimento ? new Date(creditoData.dataVencimento) : null,
              descricao: creditoData.descricao
            }
          })
        } else {
          // Atualizar crédito existente
          credito = await tx.credito.update({
            where: { id: credito.id },
            data: {
              tipo: creditoData.tipo,
              valor: creditoData.valor,
              dataVencimento: creditoData.dataVencimento ? new Date(creditoData.dataVencimento) : null,
              descricao: creditoData.descricao
            }
          })
        }
        // Criar relação processo-crédito
        await tx.processoCredito.create({
          data: {
            processoId: id,
            creditoId: credito.id,
            valorUtilizado: creditoData.valor
          }
        })
      }
      // Processar cada inscrição
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
      return { success: true }
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao salvar valores de compensação:', error)
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
    // Buscar valores de compensação para o processo
    const processo = await prisma.processo.findUnique({
      where: { id },
      include: {
        creditos: {
          include: {
            credito: true
          }
        },
        inscricoes: {
          include: {
            debitos: true
          }
        }
      }
    })
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }
    if (processo.tipo !== 'COMPENSACAO') {
      return NextResponse.json({ error: 'Processo não é do tipo Compensação' }, { status: 400 })
    }
    // Formatar dados para retorno
    const valoresCompensacao = {
      creditos: processo.creditos.map(pc => ({
        id: pc.credito.id,
        tipo: pc.credito.tipo,
        numero: pc.credito.numero,
        valor: Number(pc.credito.valor),
        dataVencimento: pc.credito.dataVencimento?.toISOString().split('T')[0],
        descricao: pc.credito.descricao,
        valorUtilizado: Number(pc.valorUtilizado)
      })),
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
      }))
    }
    return NextResponse.json(valoresCompensacao)
  } catch (error) {
    console.error('Erro ao buscar valores de compensação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}