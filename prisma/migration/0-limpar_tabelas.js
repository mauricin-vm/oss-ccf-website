// node prisma/migration/0-limpar_tabelas.js

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Função para limpar todas as tabelas exceto User e Conselheiro
async function limparTabelas() {
  try {
    console.log('🚀 Iniciando limpeza das tabelas...')
    console.log('=====================================')

    // Lista de tabelas a serem limpadas (em ordem de dependências)
    const tabelasParaLimpar = [
      // Logs e auditoria
      { nome: 'LogAuditoria', model: 'logAuditoria' },

      // Históricos
      { nome: 'HistoricoProcesso', model: 'historicoProcesso' },
      { nome: 'HistoricoPauta', model: 'historicoPauta' },

      // Votos e decisões
      { nome: 'Voto', model: 'voto' },
      { nome: 'Decisao', model: 'decisao' },

      // Sessões e pautas
      { nome: 'SessaoJulgamento', model: 'sessaoJulgamento' },
      { nome: 'ProcessoPauta', model: 'processoPauta' },
      { nome: 'Pauta', model: 'pauta' },

      // Pagamentos e parcelas
      { nome: 'PagamentoParcela', model: 'pagamentoParcela' },
      { nome: 'Parcela', model: 'parcela' },

      // Acordos
      { nome: 'AcordoInscricao', model: 'acordoInscricao' },
      { nome: 'AcordoDetalhes', model: 'acordoDetalhes' },
      { nome: 'Acordo', model: 'acordo' },

      // Transações excepcionais
      { nome: 'PropostaTransacao', model: 'propostaTransacao' },
      { nome: 'TransacaoExcepcional', model: 'transacaoExcepcional' },

      // Débitos e inscrições do processo
      { nome: 'ProcessoDebito', model: 'processoDebito' },
      { nome: 'ProcessoInscricao', model: 'processoInscricao' },

      // Relações do processo
      { nome: 'ProcessoCredito', model: 'processoCredito' },
      { nome: 'ProcessoImovel', model: 'processoImovel' },

      // Documentos e tramitações
      { nome: 'Documento', model: 'documento' },
      { nome: 'Tramitacao', model: 'tramitacao' },

      // Processo principal
      { nome: 'Processo', model: 'processo' },

      // Créditos e imóveis
      { nome: 'Credito', model: 'credito' },
      { nome: 'Imovel', model: 'imovel' },

      // Contribuintes
      { nome: 'Contribuinte', model: 'contribuinte' },

      // Setores
      { nome: 'Setor', model: 'setor' }
    ]

    console.log(`📊 Total de tabelas a serem limpas: ${tabelasParaLimpar.length}`)
    console.log('⚠️  ATENÇÃO: As tabelas User e Conselheiro NÃO serão limpas\n')

    // Confirmar contagem antes da limpeza
    console.log('📊 Contagem antes da limpeza:')
    const contagemAntes = {}

    for (const tabela of tabelasParaLimpar) {
      try {
        const count = await prisma[tabela.model].count()
        contagemAntes[tabela.nome] = count
        if (count > 0) {
          console.log(`  • ${tabela.nome}: ${count} registros`)
        }
      } catch (error) {
        console.log(`  • ${tabela.nome}: Erro ao contar (${error.message})`)
        contagemAntes[tabela.nome] = 'erro'
      }
    }

    console.log('\n🧹 Iniciando limpeza...\n')

    // Limpar tabelas na ordem correta
    let totalRegistrosRemovidos = 0

    for (const tabela of tabelasParaLimpar) {
      try {
        console.log(`🗑️  Limpando ${tabela.nome}...`)

        const result = await prisma[tabela.model].deleteMany({})

        if (result.count > 0) {
          console.log(`✅ ${tabela.nome}: ${result.count} registros removidos`)
          totalRegistrosRemovidos += result.count
        } else {
          console.log(`ℹ️  ${tabela.nome}: Tabela já estava vazia`)
        }

      } catch (error) {
        console.error(`❌ Erro ao limpar ${tabela.nome}:`, error.message)

        // Tentar limpar com truncate se deleteMany falhar
        try {
          console.log(`🔄 Tentando método alternativo para ${tabela.nome}...`)
          await prisma.$executeRaw`TRUNCATE TABLE "${tabela.nome}" RESTART IDENTITY CASCADE`
          console.log(`✅ ${tabela.nome}: Limpeza alternativa bem-sucedida`)
        } catch (truncateError) {
          console.error(`❌ Falha na limpeza alternativa de ${tabela.nome}:`, truncateError.message)
        }
      }
    }

    console.log('\n📊 RELATÓRIO FINAL:')
    console.log('==================')

    // Verificar contagem após limpeza
    console.log('\n📊 Contagem após limpeza:')
    let totalRegistrosRestantes = 0

    for (const tabela of tabelasParaLimpar) {
      try {
        const count = await prisma[tabela.model].count()
        if (count > 0) {
          console.log(`  ⚠️  ${tabela.nome}: ${count} registros restantes`)
          totalRegistrosRestantes += count
        } else {
          console.log(`  ✅ ${tabela.nome}: Vazia`)
        }
      } catch (error) {
        console.log(`  ❌ ${tabela.nome}: Erro ao verificar`)
      }
    }

    // Verificar tabelas preservadas
    console.log('\n🔒 Tabelas preservadas:')
    try {
      const countUsers = await prisma.user.count()
      const countConselheiros = await prisma.conselheiro.count()
      console.log(`  • User: ${countUsers} registros`)
      console.log(`  • Conselheiro: ${countConselheiros} registros`)
    } catch (error) {
      console.log('  ❌ Erro ao verificar tabelas preservadas')
    }

    console.log('\n🎉 LIMPEZA CONCLUÍDA!')
    console.log('====================')
    console.log(`📊 Total estimado de registros removidos: ${totalRegistrosRemovidos}`)
    console.log(`📊 Total de registros restantes: ${totalRegistrosRestantes}`)

    if (totalRegistrosRestantes > 0) {
      console.log('⚠️  ATENÇÃO: Alguns registros não foram removidos devido a restrições ou erros')
      console.log('💡 Considere executar manualmente se necessário')
    } else {
      console.log('✅ Todas as tabelas foram limpas com sucesso!')
    }

    // Resetar sequências (IDs auto incrementais)
    console.log('\n🔄 Resetando sequências...')
    try {
      await prisma.$executeRaw`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = current_schema())
          LOOP
            EXECUTE 'ALTER SEQUENCE IF EXISTS ' || quote_ident(r.tablename || '_id_seq') || ' RESTART WITH 1';
          END LOOP;
        END $$;
      `
      console.log('✅ Sequências resetadas')
    } catch (error) {
      console.log('⚠️  Aviso: Erro ao resetar sequências:', error.message)
    }

  } catch (error) {
    console.error('💥 Erro fatal durante a limpeza:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Executar limpeza
if (require.main === module) {
  console.log('⚠️  ATENÇÃO: Este script irá limpar TODAS as tabelas exceto User e Conselheiro!')
  console.log('🔒 As seguintes tabelas serão PRESERVADAS:')
  console.log('   • User')
  console.log('   • Conselheiro')
  console.log('')
  console.log('💥 TODAS as outras tabelas serão COMPLETAMENTE LIMPAS!')
  console.log('📢 Pressione Ctrl+C nos próximos 1 segundo para cancelar...')

  // Aguardar 3 segundos antes de executar
  setTimeout(() => {
    limparTabelas()
      .then(() => {
        console.log('\n🏁 Limpeza finalizada com sucesso!')
        process.exit(0)
      })
      .catch((error) => {
        console.error('\n💥 Erro fatal na limpeza:', error)
        process.exit(1)
      })
  }, 1000)
}

module.exports = { limparTabelas }