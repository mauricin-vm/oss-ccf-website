// node prisma/migration/1-migrar_processos.js

const { PrismaClient } = require('@prisma/client')
const { Client } = require('pg')

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

// Função para mapear tipos de processo
function mapearTipoProcesso(tipoAntigo) {
  if (!tipoAntigo) return 'COMPENSACAO'

  const tipo = tipoAntigo.toUpperCase()

  // Tipos que devem ser ignorados
  if (['PARECER'].includes(tipo)) {
    return null
  }

  if (['COMPENSACAO', 'COMPENSAÇÃO', 'COMP'].includes(tipo)) {
    return 'COMPENSACAO'
  }
  if (['DACAO', 'DAÇÃO', 'DACAO_PAGAMENTO', 'DACAO EM PAGAMENTO', 'DAÇÃO EM PAGAMENTO'].includes(tipo)) {
    return 'DACAO_PAGAMENTO'
  }
  if (['TRANSACAO', 'TRANSAÇÃO', 'TRANS_EXCEPCIONAL', 'TRANSACAO_EXCEPCIONAL'].includes(tipo)) {
    return 'TRANSACAO_EXCEPCIONAL'
  }

  return 'COMPENSACAO'
}

// Função para limpar CPF/CNPJ
function limparCpfCnpj(cpfCnpj) {
  if (!cpfCnpj || cpfCnpj.trim() === '') return null
  return cpfCnpj.replace(/[^0-9]/g, '')
}

// Função para limpar telefone
function limparTelefone(telefone) {
  if (!telefone || telefone.trim() === '') return null
  return telefone.replace(/[^0-9]/g, '')
}

// Função principal de migração
async function migrarProcessos() {
  const dbAntigo = new Client(dbAntigoConfig)

  try {
    console.log('🚀 Iniciando migração de processos...')
    console.log('================================')

    // Conectar ao banco antigo
    console.log('🔌 Conectando ao banco antigo...')
    await dbAntigo.connect()
    console.log('✅ Conectado ao banco antigo')

    // 1. Criar usuário de migração
    console.log('\n👤 Criando usuário de migração...')

    const usuarioMigracao = await prisma.user.upsert({
      where: { email: 'migracao_ccf@gov.br' },
      update: {},
      create: {
        id: 'migracao_ccf_user',
        email: 'migracao_ccf@gov.br',
        name: 'Usuário de Migração CCF',
        password: '$2a$10$migracao.hash.ccf.system',
        role: 'ADMIN',
        active: false
      }
    })

    console.log(`✅ Usuário de migração: ${usuarioMigracao.name}`)

    // 2. Limpar dados antigos se existirem
    console.log('\n🧹 Limpando dados antigos...')

    const deletions = await Promise.all([
      prisma.logAuditoria.deleteMany({ where: { id: { startsWith: 'log_mig_' } } }),
      prisma.historicoProcesso.deleteMany({ where: { id: { startsWith: 'hist_mig_' } } }),
      prisma.contribuinte.deleteMany({ where: { id: { startsWith: 'contrib_' } } }),
      prisma.processo.deleteMany({ where: { id: { startsWith: 'proc_' } } })
    ])

    console.log(`✅ Dados antigos removidos: ${deletions.map(d => d.count).join(', ')} registros`)

    // 3. Buscar dados do banco antigo
    console.log('\n📥 Buscando dados do banco antigo...')

    const queryProcessos = `
      SELECT
        p._id::INTEGER as id_processo,
        p.fullname::VARCHAR as nome_contribuinte,
        COALESCE(p."cpfCnpj", '') as cpf_cnpj,
        p.process::VARCHAR as numero_processo,
        p.type::VARCHAR as tipo_processo,
        p."createdAt"::TIMESTAMP as data_abertura,
        p."updatedAt"::TIMESTAMP as data_atualizacao,
        p.concluded::BOOLEAN as processo_concluido,
        COALESCE(p.observation, '') as observacoes,
        p."createdAt"::TIMESTAMP as data_criacao
      FROM ccf."Processes" p
      WHERE p.fullname IS NOT NULL AND p.process IS NOT NULL
      ORDER BY p._id
    `

    const queryContatos = `
      SELECT
        "processId"::INTEGER as process_id,
        type as tipo_contato,
        contact as contato
      FROM ccf."Contacts"
      WHERE type IN ('email', 'telefone')
    `

    const [resultProcessos, resultContatos] = await Promise.all([
      dbAntigo.query(queryProcessos),
      dbAntigo.query(queryContatos)
    ])

    const processosAntigos = resultProcessos.rows
    const contatosAntigos = resultContatos.rows

    console.log(`📊 Processos encontrados: ${processosAntigos.length}`)
    console.log(`📞 Contatos encontrados: ${contatosAntigos.length}`)

    // 4. Organizar contatos por processo
    const contatosPorProcesso = {}
    for (const contato of contatosAntigos) {
      if (!contatosPorProcesso[contato.process_id]) {
        contatosPorProcesso[contato.process_id] = {}
      }
      contatosPorProcesso[contato.process_id][contato.tipo_contato] = contato.contato
    }

    // 5. Migrar contribuintes
    console.log('\n👥 Migrando contribuintes...')

    let contribuintesCriados = 0
    let processosIgnorados = 0

    for (const proc of processosAntigos) {
      const tipoMapeado = mapearTipoProcesso(proc.tipo_processo)

      // Ignorar processos que retornam null (como PARECER)
      if (tipoMapeado === null) {
        processosIgnorados++
        console.log(`⚠️  Ignorando processo ${proc.numero_processo} do tipo '${proc.tipo_processo}'`)
        continue
      }

      const contatos = contatosPorProcesso[proc.id_processo] || {}

      await prisma.contribuinte.create({
        data: {
          id: `contrib_${proc.id_processo}`,
          nome: proc.nome_contribuinte,
          cpfCnpj: limparCpfCnpj(proc.cpf_cnpj),
          email: contatos.email && contatos.email.trim() !== '' ? contatos.email.trim() : null,
          telefone: limparTelefone(contatos.telefone),
          createdAt: (() => { const d = new Date(proc.data_criacao); d.setHours(12, 0, 0, 0); return d; })(),
          updatedAt: (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })()
        }
      })

      contribuintesCriados++

      if (contribuintesCriados % 100 === 0) {
        console.log(`📊 Contribuintes processados: ${contribuintesCriados}`)
      }
    }

    console.log(`✅ Contribuintes criados: ${contribuintesCriados}`)
    console.log(`⚠️  Processos ignorados: ${processosIgnorados}`)

    // 6. Migrar processos
    console.log('\n📄 Migrando processos...')

    let processosCriados = 0

    for (const proc of processosAntigos) {
      const tipoMapeado = mapearTipoProcesso(proc.tipo_processo)

      // Ignorar processos que retornam null (como PARECER)
      if (tipoMapeado === null) {
        continue
      }

      const dataFinalizacao = proc.processo_concluido ? (() => { const d = new Date(proc.data_atualizacao); d.setHours(12, 0, 0, 0); return d; })() : null

      await prisma.processo.create({
        data: {
          id: `proc_${proc.id_processo}`,
          numero: proc.numero_processo,
          tipo: tipoMapeado,
          status: 'RECEPCIONADO',
          dataAbertura: (() => { const d = new Date(proc.data_abertura); d.setHours(12, 0, 0, 0); return d; })(),
          dataFinalizacao,
          observacoes: '',
          contribuinteId: `contrib_${proc.id_processo}`,
          createdById: usuarioMigracao.id,
          createdAt: (() => { const d = new Date(proc.data_criacao); d.setHours(12, 0, 0, 0); return d; })(),
          updatedAt: (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })()
        }
      })

      processosCriados++

      if (processosCriados % 100 === 0) {
        console.log(`📊 Processos processados: ${processosCriados}`)
      }
    }

    console.log(`✅ Processos criados: ${processosCriados}`)

    // 7. Criar históricos
    console.log('\n📝 Criando históricos...')

    const processosMigrados = await prisma.processo.findMany({
      where: { id: { startsWith: 'proc_' } },
      select: { id: true, numero: true, createdAt: true }
    })

    let historicosCriados = 0

    for (const processo of processosMigrados) {
      await prisma.historicoProcesso.create({
        data: {
          id: `hist_mig_${processo.id}`,
          processoId: processo.id,
          usuarioId: usuarioMigracao.id,
          titulo: 'Processo Migrado',
          descricao: `Processo ${processo.numero} migrado do sistema antigo CCF.`,
          tipo: 'SISTEMA',
          createdAt: (() => { const d = new Date(processo.createdAt); d.setHours(12, 0, 0, 0); return d; })()
        }
      })

      historicosCriados++

      if (historicosCriados % 100 === 0) {
        console.log(`📊 Históricos processados: ${historicosCriados}`)
      }
    }

    console.log(`✅ Históricos criados: ${historicosCriados}`)

    // 8. Criar logs de auditoria
    console.log('\n📋 Criando logs de auditoria...')

    let logsCriados = 0

    for (const processo of processosMigrados) {
      const dadosProcesso = await prisma.processo.findUnique({
        where: { id: processo.id },
        select: { numero: true, tipo: true, status: true }
      })

      await prisma.logAuditoria.create({
        data: {
          id: `log_mig_${processo.id}`,
          usuarioId: usuarioMigracao.id,
          acao: 'MIGRATE',
          entidade: 'Processo',
          entidadeId: processo.id,
          dadosNovos: {
            numero: dadosProcesso.numero,
            tipo: dadosProcesso.tipo,
            status: dadosProcesso.status
          },
          createdAt: (() => { const d = new Date(processo.createdAt); d.setHours(12, 0, 0, 0); return d; })()
        }
      })

      logsCriados++

      if (logsCriados % 100 === 0) {
        console.log(`📊 Logs processados: ${logsCriados}`)
      }
    }

    console.log(`✅ Logs criados: ${logsCriados}`)

    // 9. Relatório final
    console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!')
    console.log('================================')
    console.log(`👥 Contribuintes migrados: ${contribuintesCriados}`)
    console.log(`📄 Processos migrados: ${processosCriados}`)
    console.log(`⚠️  Processos ignorados (PARECER): ${processosIgnorados}`)
    console.log(`📝 Históricos criados: ${historicosCriados}`)
    console.log(`📋 Logs criados: ${logsCriados}`)

    // 10. Verificação final - mostrar alguns registros
    console.log('\n🔍 VERIFICAÇÃO FINAL:')
    console.log('================================')

    const amostraProcessos = await prisma.processo.findMany({
      where: { id: { startsWith: 'proc_' } },
      include: { contribuinte: true },
      orderBy: { dataAbertura: 'desc' },
      take: 5
    })

    console.log('📋 Últimos 5 processos migrados:')
    amostraProcessos.forEach(proc => {
      console.log(`  • ${proc.numero} - ${proc.tipo} - ${proc.contribuinte.nome} - ${proc.dataAbertura.toISOString().split('T')[0]}`)
    })

  } catch (error) {
    console.error('❌ Erro durante a migração:', error)
    throw error
  } finally {
    // Fechar conexões
    await dbAntigo.end()
    await prisma.$disconnect()
  }
}

// Executar migração
if (require.main === module) {
  migrarProcessos()
    .then(() => {
      console.log('\n🏁 Migração finalizada com sucesso!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Erro fatal na migração:', error)
      process.exit(1)
    })
}

module.exports = { migrarProcessos }