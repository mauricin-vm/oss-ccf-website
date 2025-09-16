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
const inscricaoOferecidaSchema = z.object({
  numeroInscricao: z.string().min(1),
  tipoInscricao: z.enum(['imobiliaria', 'economica']),
  valor: z.number().min(0.01),
  dataVencimento: z.string().optional(),
  descricao: z.string().optional()
})
const inscricaoCompensarSchema = z.object({
  numeroInscricao: z.string().min(1),
  tipoInscricao: z.enum(['imobiliaria', 'economica']),
  debitos: z.array(debitoSchema).min(1, 'Pelo menos um débito deve ser informado')
})
const valoresDacaoSchema = z.object({
  inscricoesOferecidas: z.array(inscricaoOferecidaSchema),
  inscricoesCompensar: z.array(inscricaoCompensarSchema)
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
    const validationResult = valoresDacaoSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validationResult.error.issues },
        { status: 400 }
      )
    }
    const { inscricoesOferecidas, inscricoesCompensar } = validationResult.data
    // Verificar se o processo existe e é do tipo correto
    const processo = await prisma.processo.findUnique({
      where: { id },
      include: { contribuinte: true }
    })
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }
    if (processo.tipo !== 'DACAO_PAGAMENTO') {
      return NextResponse.json({ error: 'Processo não é do tipo Dação em Pagamento' }, { status: 400 })
    }
    // Iniciar transação para salvar os dados
    const result = await prisma.$transaction(async (tx) => {
      // Primeiro, remover valores existentes para este processo
      await tx.processoImovel.deleteMany({
        where: { processoId: id }
      })
      // Remover inscrições existentes
      await tx.processoInscricao.deleteMany({
        where: { processoId: id }
      })
      // Processar cada inscrição oferecida (como imóveis para dação)
      for (const inscricaoData of inscricoesOferecidas) {
        // Verificar se o imóvel já existe ou criar um novo
        let imovel = await tx.imovel.findUnique({
          where: { matricula: inscricaoData.numeroInscricao }
        })
        if (!imovel) {
          // Criar novo imóvel usando o número da inscrição como matrícula
          imovel = await tx.imovel.create({
            data: {
              matricula: inscricaoData.numeroInscricao,
              endereco: `Inscrição ${inscricaoData.tipoInscricao}`,
              cidade: 'N/A',
              estado: 'N/A',
              valorAvaliado: inscricaoData.valor,
              descricao: inscricaoData.descricao,
              proprietarioId: processo.contribuinteId
            }
          })
        } else {
          // Atualizar imóvel existente
          imovel = await tx.imovel.update({
            where: { id: imovel.id },
            data: {
              valorAvaliado: inscricaoData.valor,
              descricao: inscricaoData.descricao
            }
          })
        }
        // Criar relação processo-imóvel
        await tx.processoImovel.create({
          data: {
            processoId: id,
            imovelId: imovel.id,
            tipoRelacao: 'oferecido'
          }
        })
      }
      // Processar cada inscrição a compensar
      for (const inscricaoData of inscricoesCompensar) {
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
    console.error('Erro ao salvar valores de dação:', error)
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
    // Buscar valores de dação para o processo
    const processo = await prisma.processo.findUnique({
      where: { id },
      include: {
        imoveis: {
          include: {
            imovel: true
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
    if (processo.tipo !== 'DACAO_PAGAMENTO') {
      return NextResponse.json({ error: 'Processo não é do tipo Dação em Pagamento' }, { status: 400 })
    }
    // Formatar dados para retorno
    const valoresDacao = {
      inscricoesOferecidas: processo.imoveis.map(pi => ({
        id: pi.imovel.id,
        numeroInscricao: pi.imovel.matricula,
        tipoInscricao: pi.imovel.endereco.includes('imobiliaria') ? 'imobiliaria' : 'economica',
        valor: Number(pi.imovel.valorAvaliado || 0),
        dataVencimento: '',
        descricao: pi.imovel.descricao
      })),
      inscricoesCompensar: processo.inscricoes.map(inscricao => ({
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
    return NextResponse.json(valoresDacao)
  } catch (error) {
    console.error('Erro ao buscar valores de dação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}