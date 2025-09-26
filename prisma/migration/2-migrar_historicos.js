// node prisma/migration/2-migrar_historicos.js

import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'

const prisma = new PrismaClient()

// Configuração do banco antigo
// const dbAntigoConfig = {
//   host: 'localhost',
//   port: 5432,
//   database: 'sefin',
//   user: 'postgres',
//   password: 'admin'
// }
const dbAntigoConfig = {
  host: '10.20.5.196',
  port: 5432,
  database: 'sefin',
  user: 'postgres',
  password: 'admin'
}

// Função principal de migração dos históricos
async function migrarHistoricos() {
  const dbAntigo = new Client(dbAntigoConfig)

  try {
    console.log('🚀 Iniciando migração de históricos (Situations)...')
    console.log('================================================')

    // Conectar ao banco antigo
    console.log('🔌 Conectando ao banco antigo...')
    await dbAntigo.connect()
    console.log('✅ Conectado ao banco antigo')

    // 1. Verificar dados existentes
    console.log('\n📊 Verificando dados existentes...')

    const historicoAtuais = await prisma.historicoProcesso.count()
    console.log(`📊 Históricos atuais no sistema: ${historicoAtuais}`)

    // Verificar dados de Situations no banco antigo
    const resultSituationsCount = await dbAntigo.query(
      'SELECT COUNT(*) as total_situations FROM ccf."Situations"'
    )
    const totalSituations = parseInt(resultSituationsCount.rows[0].total_situations)
    console.log(`📊 Situations encontradas no banco antigo: ${totalSituations}`)

    // 2. Buscar usuário de migração
    console.log('\n👤 Buscando usuário de migração...')

    let usuarioMigracao = await prisma.user.findFirst({
      where: { email: 'migracao_ccf@gov.br' }
    })

    if (!usuarioMigracao) {
      usuarioMigracao = await prisma.user.findFirst()
      console.log(`⚠️  Usuário de migração não encontrado, usando: ${usuarioMigracao.email}`)
    } else {
      console.log(`✅ Usuário de migração: ${usuarioMigracao.email}`)
    }

    // 3. Remover históricos antigos da migração se existirem
    console.log('\n🧹 Removendo históricos antigos da migração...')

    const deletedHistoricos = await prisma.historicoProcesso.deleteMany({
      where: { id: { startsWith: 'hist_sit_' } }
    })

    const deletedLogs = await prisma.logAuditoria.deleteMany({
      where: { id: { startsWith: 'log_hist_mig_' } }
    })

    console.log(`✅ Históricos removidos: ${deletedHistoricos.count}`)
    console.log(`✅ Logs removidos: ${deletedLogs.count}`)

    // 4. Buscar dados de Situations
    console.log('\n📥 Buscando dados de Situations...')

    const querySituations = `
      SELECT
        s._id::INTEGER as situation_id,
        s."processId"::INTEGER as process_id,
        s.title::VARCHAR as titulo,
        s.situation::TEXT as situacao,
        s."createdAt"::TIMESTAMP as data_criacao
      FROM ccf."Situations" s
      WHERE s.title IS NOT NULL
        AND s.situation IS NOT NULL
      ORDER BY s."createdAt" ASC
    `

    const resultSituations = await dbAntigo.query(querySituations)
    const situations = resultSituations.rows

    console.log(`📊 Situations válidas encontradas: ${situations.length}`)

    // 5. Mostrar amostra dos dados
    console.log('\n🔍 Amostra dos dados (primeiros 5):')
    situations.slice(0, 5).forEach((sit, index) => {
      console.log(`  ${index + 1}. Processo: ${sit.process_id} | Título: ${sit.titulo} | Data: ${sit.data_criacao.toISOString().split('T')[0]}`)
    })

    // 6. Migrar Situations para HistoricoProcesso
    console.log('\n📝 Migrando Situations para HistoricoProcesso...')

    let historicosCriados = 0
    let historicosIgnorados = 0

    for (const situation of situations) {
      const processoId = `proc_${situation.process_id}`

      // Verificar se o processo existe
      const processoExiste = await prisma.processo.findUnique({
        where: { id: processoId },
        select: { id: true }
      })

      if (!processoExiste) {
        historicosIgnorados++
        continue
      }

      try {
        await prisma.historicoProcesso.create({
          data: {
            id: `hist_sit_${situation.situation_id}`,
            processoId: processoId,
            usuarioId: usuarioMigracao.id,
            titulo: situation.titulo,
            descricao: situation.situacao,
            tipo: 'SISTEMA',
            createdAt: (() => { const d = new Date(situation.data_criacao); d.setHours(12, 0, 0, 0); return d; })()
          }
        })

        historicosCriados++

        if (historicosCriados % 50 === 0) {
          console.log(`📊 Históricos processados: ${historicosCriados}`)
        }

      } catch (error) {
        if (error.code === 'P2002') {
          // Conflito de ID único, ignorar
          continue
        }
        throw error
      }
    }

    console.log(`✅ Históricos criados: ${historicosCriados}`)
    console.log(`⚠️  Históricos ignorados (processo não existe): ${historicosIgnorados}`)

    // 7. Criar logs de auditoria
    console.log('\n📋 Criando logs de auditoria...')

    const historicosMigrados = await prisma.historicoProcesso.findMany({
      where: { id: { startsWith: 'hist_sit_' } },
      select: { id: true, titulo: true, tipo: true, usuarioId: true, createdAt: true }
    })

    let logsCriados = 0

    for (const historico of historicosMigrados) {
      try {
        await prisma.logAuditoria.create({
          data: {
            id: `log_hist_mig_${historico.id}`,
            usuarioId: historico.usuarioId,
            acao: 'MIGRATE',
            entidade: 'HistoricoProcesso',
            entidadeId: historico.id,
            dadosNovos: {
              titulo: historico.titulo,
              tipo: historico.tipo,
              origem: 'situations_sistema_antigo',
              data_migracao: new Date().toISOString()
            },
            createdAt: (() => { const d = new Date(historico.createdAt); d.setHours(12, 0, 0, 0); return d; })()
          }
        })

        logsCriados++

        if (logsCriados % 50 === 0) {
          console.log(`📊 Logs processados: ${logsCriados}`)
        }

      } catch (error) {
        if (error.code === 'P2002') {
          // Conflito de ID único, ignorar
          continue
        }
        throw error
      }
    }

    console.log(`✅ Logs de auditoria criados: ${logsCriados}`)

    // 8. Estatísticas e relatórios
    console.log('\n📊 RELATÓRIO DA MIGRAÇÃO DE HISTÓRICOS')
    console.log('=====================================')

    const estatisticas = await Promise.all([
      prisma.historicoProcesso.count(),
      prisma.historicoProcesso.count({ where: { id: { startsWith: 'hist_sit_' } } }),
      prisma.historicoProcesso.count({ where: { id: { startsWith: 'hist_mig_' } } }),
      prisma.logAuditoria.count({ where: { id: { startsWith: 'log_hist_mig_' } } })
    ])

    console.log(`📊 Total de históricos no sistema: ${estatisticas[0]}`)
    console.log(`📊 Históricos migrados (Situations): ${estatisticas[1]}`)
    console.log(`📊 Históricos de migração de processo: ${estatisticas[2]}`)
    console.log(`📊 Logs de auditoria de históricos: ${estatisticas[3]}`)

    // 9. Históricos por tipo
    console.log('\n📋 Históricos por tipo:')

    const historicosPorTipo = await prisma.historicoProcesso.groupBy({
      by: ['tipo'],
      where: { id: { startsWith: 'hist_sit_' } },
      _count: { tipo: true }
    })

    historicosPorTipo.forEach(grupo => {
      console.log(`  • ${grupo.tipo}: ${grupo._count.tipo}`)
    })

    // 10. Top 10 processos com mais históricos
    console.log('\n🏆 Top 10 processos com mais históricos:')

    const processosComHistoricos = await prisma.historicoProcesso.groupBy({
      by: ['processoId'],
      where: { id: { startsWith: 'hist_sit_' } },
      _count: { processoId: true },
      orderBy: { _count: { processoId: 'desc' } },
      take: 10
    })

    for (const grupo of processosComHistoricos) {
      const processo = await prisma.processo.findUnique({
        where: { id: grupo.processoId },
        select: { numero: true }
      })
      console.log(`  • Processo ${processo?.numero || grupo.processoId}: ${grupo._count.processoId} históricos`)
    }

    // 11. Amostra dos históricos migrados
    console.log('\n📋 AMOSTRA DOS HISTÓRICOS MIGRADOS (últimos 10):')

    const amostraHistoricos = await prisma.historicoProcesso.findMany({
      where: { id: { startsWith: 'hist_sit_' } },
      include: { processo: { select: { numero: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    amostraHistoricos.forEach((hist, index) => {
      const data = hist.createdAt.toISOString().split('T')[0]
      console.log(`  ${index + 1}. ${hist.processo.numero} - ${hist.titulo} - ${hist.tipo} - ${data}`)
    })

    // 13. Resultado final
    console.log('\n🎉 MIGRAÇÃO DE HISTÓRICOS CONCLUÍDA!')
    console.log('===================================')
    console.log(`📊 Históricos totais: ${estatisticas[0]}`)
    console.log(`📊 Históricos de Situations: ${estatisticas[1]}`)
    console.log(`📋 Logs de auditoria: ${estatisticas[3]}`)

  } catch (error) {
    console.error('❌ Erro durante a migração de históricos:', error)
    throw error
  } finally {
    // Fechar conexões
    await dbAntigo.end()
    await prisma.$disconnect()
  }
}

// Executar migração
if (require.main === module) {
  migrarHistoricos()
    .then(() => {
      console.log('\n🏁 Migração de históricos finalizada com sucesso!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Erro fatal na migração de históricos:', error)
      process.exit(1)
    })
}

export { migrarHistoricos }