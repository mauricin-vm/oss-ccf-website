import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Iniciando limpeza dos dados...')

  try {
    // Deletar dados em ordem reversa devido às dependências de chave estrangeira
    await prisma.pagamentoParcela.deleteMany()
    console.log('✅ Pagamentos de parcelas removidos')

    await prisma.parcela.deleteMany()
    console.log('✅ Parcelas removidas')

    await prisma.acordo.deleteMany()
    console.log('✅ Acordos removidos')

    await prisma.decisao.deleteMany()
    console.log('✅ Decisões removidas')

    await prisma.sessaoJulgamento.deleteMany()
    console.log('✅ Sessões de julgamento removidas')

    await prisma.processoPauta.deleteMany()
    console.log('✅ Relações processo-pauta removidas')

    await prisma.pauta.deleteMany()
    console.log('✅ Pautas removidas')

    await prisma.documento.deleteMany()
    console.log('✅ Documentos removidos')

    await prisma.tramitacao.deleteMany()
    console.log('✅ Tramitações removidas')

    await prisma.processoCredito.deleteMany()
    console.log('✅ Relações processo-crédito removidas')

    await prisma.credito.deleteMany()
    console.log('✅ Créditos removidos')

    await prisma.processoImovel.deleteMany()
    console.log('✅ Relações processo-imóvel removidas')

    await prisma.imovel.deleteMany()
    console.log('✅ Imóveis removidos')

    await prisma.processo.deleteMany()
    console.log('✅ Processos removidos')

    await prisma.contribuinte.deleteMany()
    console.log('✅ Contribuintes removidos')

    await prisma.logAuditoria.deleteMany()
    console.log('✅ Logs de auditoria removidos')

    await prisma.setor.deleteMany()
    console.log('✅ Setores removidos')

    await prisma.user.deleteMany()
    console.log('✅ Usuários removidos')

    console.log('\n🎉 Limpeza concluída com sucesso!')
    console.log('📋 Todas as tabelas foram limpas e estão prontas para novos dados.')
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error)
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })