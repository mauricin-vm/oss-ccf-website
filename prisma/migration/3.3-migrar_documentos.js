// node prisma/migration/3.3-migrar_documentos.js

const { PrismaClient } = require('@prisma/client')
const { Client } = require('pg')
const fs = require('fs')

const prisma = new PrismaClient()

// Configuração do banco antigo (mesmo padrão do arquivo 1-migrar_processos.js)
const dbAntigoConfig = {
  host: '10.20.5.196',
  port: 5432,
  database: 'sefin',
  user: 'postgres',
  password: 'admin'
}



// Função para determinar o tipo MIME baseado na extensão
function obterTipoMime(extensao) {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'txt': 'text/plain'
  }

  return mimeTypes[extensao.toLowerCase()] || 'application/octet-stream'
}

// Função principal de migração
async function migrarDocumentos() {
  const dbAntigo = new Client(dbAntigoConfig)

  try {
    console.log('🚀 Iniciando migração de documentos...')
    console.log('================================')

    // Conectar ao banco antigo
    console.log('🔌 Conectando ao banco antigo...')
    await dbAntigo.connect()
    console.log('✅ Conectado ao banco antigo')

    // 1. Buscar usuário de migração
    console.log('\n👤 Verificando usuário de migração...')

    const usuarioMigracao = await prisma.user.findUnique({
      where: { email: 'migracao_ccf@gov.br' }
    })

    if (!usuarioMigracao) {
      console.log('❌ Usuário de migração não encontrado!')
      console.log('💡 Execute primeiro: node prisma/migration/1-migrar_processos.js')
      return
    }

    console.log(`✅ Usuário de migração: ${usuarioMigracao.name}`)

    // 2. Limpar documentos antigos se existirem
    console.log('\n🧹 Limpando documentos de migração anteriores...')

    const deletedDocs = await prisma.documento.deleteMany({
      where: { id: { startsWith: 'doc_mig_' } }
    })

    console.log(`✅ Documentos antigos removidos: ${deletedDocs.count} registros`)

    // 3. Buscar dados do banco antigo
    console.log('\n📥 Buscando documentos do banco antigo...')

    const queryDocumentos = `
      SELECT
        f."_id"::INTEGER as id_arquivo,
        f."situationId"::INTEGER as situation_id,
        f.title::VARCHAR as nome_arquivo,
        f.size::INTEGER as tamanho,
        f."filePath"::VARCHAR as caminho_arquivo,
        f."fileType"::VARCHAR as tipo_arquivo,
        f."fileExtension"::VARCHAR as extensao,
        f."createdAt"::TIMESTAMP as data_criacao,
        s."processId"::INTEGER as process_id,
        p.process::VARCHAR as numero_processo
      FROM ccf."Files" f
      INNER JOIN ccf."Situations" s ON f."situationId" = s."_id"
      INNER JOIN ccf."Processes" p ON s."processId" = p."_id"
      WHERE f.title IS NOT NULL AND f."filePath" IS NOT NULL
      ORDER BY f."createdAt" ASC
    `

    const resultDocumentos = await dbAntigo.query(queryDocumentos)
    const documentosAntigos = resultDocumentos.rows

    console.log(`📊 Documentos encontrados: ${documentosAntigos.length}`)

    // 4. Processar documentos
    console.log('\n📄 Migrando documentos...')

    let documentosMigrados = 0
    let documentosPulados = 0
    let documentosErros = 0

    for (const doc of documentosAntigos) {
      try {
        // Buscar o processo no sistema atual pelo número
        const processoAtual = await prisma.processo.findFirst({
          where: { numero: doc.numero_processo },
          select: { id: true, numero: true }
        })

        if (!processoAtual) {
          console.log(`⚠️  Processo ${doc.numero_processo} não encontrado - SKIP`)
          documentosPulados++
          continue
        }

        // Verificar se o documento já foi migrado
        const documentoExistente = await prisma.documento.findFirst({
          where: {
            processoId: processoAtual.id,
            nome: doc.nome_arquivo,
            url: doc.caminho_arquivo
          }
        })

        if (documentoExistente) {
          documentosPulados++
          continue
        }

        // Verificar se o arquivo físico existe
        if (!fs.existsSync(doc.caminho_arquivo)) {
          console.log(`❌ Arquivo físico não encontrado: ${doc.caminho_arquivo}`)
          documentosErros++
          continue
        }

        // Criar o documento no sistema atual
        const tipoMime = obterTipoMime(doc.extensao)
        const dataOriginal = (() => { const d = new Date(doc.data_criacao); d.setHours(12, 0, 0, 0); return d; })()

        const novoDocumento = await prisma.documento.create({
          data: {
            id: `doc_mig_${doc.id_arquivo}`,
            processoId: processoAtual.id,
            nome: doc.nome_arquivo,
            tipo: tipoMime,
            url: doc.caminho_arquivo,
            tamanho: doc.tamanho,
            createdAt: dataOriginal,
            updatedAt: (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })()
          }
        })

        // Criar log de auditoria com a data original do documento
        await prisma.logAuditoria.create({
          data: {
            id: `log_mig_doc_${novoDocumento.id}`,
            usuarioId: usuarioMigracao.id,
            acao: 'MIGRATE',
            entidade: 'Documento',
            entidadeId: novoDocumento.id,
            dadosNovos: {
              nome: novoDocumento.nome,
              processoId: novoDocumento.processoId,
              numeroProcesso: doc.numero_processo
            },
            createdAt: dataOriginal // Usar a data original do documento
          }
        })

        documentosMigrados++

        if (documentosMigrados % 50 === 0) {
          console.log(`📊 Documentos processados: ${documentosMigrados}`)
        }

      } catch (error) {
        console.error(`❌ Erro ao migrar documento ${doc.nome_arquivo}:`, error.message)
        documentosErros++
      }
    }

    console.log(`✅ Documentos migrados: ${documentosMigrados}`)
    console.log(`✅ Logs de auditoria criados: ${documentosMigrados}`)

    // 6. Relatório final
    console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!')
    console.log('================================')
    console.log(`📄 Documentos migrados: ${documentosMigrados}`)
    console.log(`⚠️  Documentos pulados: ${documentosPulados}`)
    console.log(`❌ Documentos com erro: ${documentosErros}`)
    console.log(`📋 Logs criados: ${documentosMigrados}`)
    console.log(`📁 Total processados: ${documentosAntigos.length}`)

    // 7. Verificação final - mostrar alguns registros
    console.log('\n🔍 VERIFICAÇÃO FINAL:')
    console.log('================================')

    const amostraDocumentos = await prisma.documento.findMany({
      where: { id: { startsWith: 'doc_mig_' } },
      include: { processo: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    console.log('📋 Últimos 5 documentos migrados:')
    amostraDocumentos.forEach(doc => {
      console.log(`  • ${doc.nome} - ${doc.processo.numero} - ${(doc.tamanho / 1024).toFixed(1)}KB - ${doc.createdAt.toISOString().split('T')[0]}`)
    })

    // 8. Verificar integridade
    const totalDocumentosAtual = await prisma.documento.count()
    console.log(`\n📊 Total de documentos no sistema: ${totalDocumentosAtual}`)

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
  migrarDocumentos()
    .then(() => {
      console.log('\n🏁 Migração finalizada com sucesso!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Erro fatal na migração:', error)
      process.exit(1)
    })
}

module.exports = { migrarDocumentos }