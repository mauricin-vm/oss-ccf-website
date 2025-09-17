import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearDatabase() {
  console.log('🧹 Iniciando limpeza do banco de dados...')

  try {
    // Para PostgreSQL, vamos usar uma abordagem mais simples com as models do Prisma
    console.log('🗑️  Limpando tabelas...')

    // Limpa na ordem inversa das dependências usando Prisma
    await prisma.pagamentoParcela.deleteMany()
    console.log('✅ PagamentoParcela')

    await prisma.parcela.deleteMany()
    console.log('✅ Parcela')

    await prisma.acordoInscricao.deleteMany()
    console.log('✅ AcordoInscricao')

    await prisma.acordoDetalhes.deleteMany()
    console.log('✅ AcordoDetalhes')

    await prisma.acordo.deleteMany()
    console.log('✅ Acordo')

    await prisma.processoDebito.deleteMany()
    console.log('✅ ProcessoDebito')

    await prisma.processoInscricao.deleteMany()
    console.log('✅ ProcessoInscricao')

    await prisma.propostaTransacao.deleteMany()
    console.log('✅ PropostaTransacao')

    await prisma.transacaoExcepcional.deleteMany()
    console.log('✅ TransacaoExcepcional')

    await prisma.voto.deleteMany()
    console.log('✅ Voto')

    await prisma.decisao.deleteMany()
    console.log('✅ Decisao')

    await prisma.processoPauta.deleteMany()
    console.log('✅ ProcessoPauta')

    await prisma.sessaoJulgamento.deleteMany()
    console.log('✅ SessaoJulgamento')

    await prisma.pauta.deleteMany()
    console.log('✅ Pauta')

    await prisma.documento.deleteMany()
    console.log('✅ Documento')

    await prisma.tramitacao.deleteMany()
    console.log('✅ Tramitacao')

    await prisma.processoCredito.deleteMany()
    console.log('✅ ProcessoCredito')

    await prisma.processoImovel.deleteMany()
    console.log('✅ ProcessoImovel')

    await prisma.historicoProcesso.deleteMany()
    console.log('✅ HistoricoProcesso')

    await prisma.historicoPauta.deleteMany()
    console.log('✅ HistoricoPauta')

    await prisma.logAuditoria.deleteMany()
    console.log('✅ LogAuditoria')

    await prisma.processo.deleteMany()
    console.log('✅ Processo')

    await prisma.credito.deleteMany()
    console.log('✅ Credito')

    await prisma.imovel.deleteMany()
    console.log('✅ Imovel')

    await prisma.contribuinte.deleteMany()
    console.log('✅ Contribuinte')

    await prisma.conselheiro.deleteMany()
    console.log('✅ Conselheiro')

    await prisma.setor.deleteMany()
    console.log('✅ Setor')

    await prisma.user.deleteMany()
    console.log('✅ User')

    console.log('🎉 Limpeza do banco de dados concluída!')

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearDatabase()