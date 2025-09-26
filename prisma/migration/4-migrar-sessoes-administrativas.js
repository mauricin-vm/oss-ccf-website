// node prisma/migration/4-migrar-sessoes-administrativas.js

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniciando migração de sessões administrativas...')

  // Carregar dados do arquivo JSON
  const dataPath = path.join(__dirname, '3.0-data-old-db.json')
  const rawData = fs.readFileSync(dataPath, 'utf8')
  const data = JSON.parse(rawData)

  if (!data.atas || !Array.isArray(data.atas)) {
    throw new Error('Dados de atas não encontrados no arquivo JSON')
  }

  // Filtrar apenas as atas sem processos (sessões administrativas)
  const sessoesAdministrativas = data.atas.filter(ata =>
    ata.processos && Array.isArray(ata.processos) && ata.processos.length === 0
  )

  console.log(`📊 Total de atas encontradas: ${data.atas.length}`)
  console.log(`📋 Sessões administrativas (sem processos): ${sessoesAdministrativas.length}`)

  let migradas = 0
  let erros = 0
  const errosDetalhados = []

  for (const [index, ata] of sessoesAdministrativas.entries()) {
    try {
      console.log(`\n[${index + 1}/${sessoesAdministrativas.length}] Processando ata: ${ata.numeroanoata}`)

      // Validar dados obrigatórios
      if (!ata.numeroanoata || !ata.dataata || !ata.presidente) {
        throw new Error(`Dados obrigatórios faltando: numeroanoata=${ata.numeroanoata}, dataata=${ata.dataata}, presidente=${ata.presidente}`)
      }

      // Converter data
      const [recDia, recMes, recAno] = ata.dataata.split("/"); // "23/09/2025"
      const dataInicio = new Date(`${recAno}-${recMes}-${recDia}`);
      dataInicio.setHours(12, 0, 0, 0)
      if (isNaN(dataInicio.getTime())) {
        throw new Error(`Data inválida: ${ata.dataata}`)
      }

      // Buscar presidente no banco de dados
      let presidente = null
      if (ata.presidente && ata.presidente.trim()) {
        presidente = await prisma.conselheiro.findFirst({
          where: {
            nome: {
              contains: ata.presidente.trim(),
              mode: 'insensitive'
            }
          }
        })

        if (!presidente) {
          console.log(`⚠️  Presidente não encontrado: "${ata.presidente}" - criando sessão sem presidente`)
        } else {
          console.log(`✅ Presidente encontrado: ${presidente.nome}`)
        }
      }

      // Buscar conselheiros participantes
      const conselheirosEncontrados = []
      if (ata.conselheirosparticipantes && Array.isArray(ata.conselheirosparticipantes)) {
        for (const nomeConselheiro of ata.conselheirosparticipantes) {
          if (!nomeConselheiro || !nomeConselheiro.trim()) continue

          const conselheiro = await prisma.conselheiro.findFirst({
            where: {
              nome: {
                contains: nomeConselheiro.trim(),
                mode: 'insensitive'
              }
            }
          })

          if (conselheiro) {
            // Não incluir o presidente na lista de participantes
            if (!presidente || conselheiro.id !== presidente.id) {
              conselheirosEncontrados.push(conselheiro)
            }
          } else {
            console.log(`⚠️  Conselheiro não encontrado: "${nomeConselheiro}"`)
          }
        }
      }

      console.log(`👥 Conselheiros participantes encontrados: ${conselheirosEncontrados.length}`)

      // Criar agenda básica para sessão administrativa
      const agenda = `Sessão Administrativa - Ata ${ata.numeroanoata}
Data: ${dataInicio.toLocaleDateString('pt-BR')}

Assuntos administrativos diversos conforme registrado na ata original.`

      // Verificar se a sessão já existe
      const sessaoExistente = await prisma.sessaoJulgamento.findFirst({
        where: {
          numeroAta: ata.numeroanoata
        }
      })

      if (sessaoExistente) {
        console.log(`⚠️  Sessão já existe com ata ${ata.numeroanoata}, pulando...`)
        continue
      }

      // Criar a sessão administrativa
      const sessao = await prisma.sessaoJulgamento.create({
        data: {
          tipoSessao: 'ADMINISTRATIVA',
          dataInicio: dataInicio,
          dataFim: dataInicio, // Definir dataFim igual à dataInicio para sessões administrativas
          numeroAta: ata.numeroanoata,
          agenda: agenda,
          assuntosAdministrativos: 'Migrado do sistema anterior - detalhes na ata original.',
          presidenteId: presidente?.id || null,
          conselheiros: {
            connect: conselheirosEncontrados.map(c => ({ id: c.id }))
          },
          createdAt: dataInicio, // Definir createdAt como a data da sessão
          updatedAt: dataInicio  // Definir updatedAt como a data da sessão também
        },
        include: {
          presidente: true,
          conselheiros: true
        }
      })

      console.log(`✅ Sessão administrativa criada: ID ${sessao.id}`)
      console.log(`   - Tipo: ${sessao.tipoSessao}`)
      console.log(`   - Data: ${sessao.dataInicio.toLocaleDateString('pt-BR')}`)
      console.log(`   - Ata: ${sessao.numeroAta}`)
      console.log(`   - Presidente: ${sessao.presidente?.nome || 'Não definido'}`)
      console.log(`   - Participantes: ${sessao.conselheiros.length}`)

      migradas++

    } catch (error) {
      erros++
      const erroInfo = {
        ata: ata.numeroanoata,
        erro: error.message,
        dados: {
          dataata: ata.dataata,
          presidente: ata.presidente,
          participantes: ata.conselheirosparticipantes?.length || 0
        }
      }
      errosDetalhados.push(erroInfo)

      console.error(`❌ Erro ao processar ata ${ata.numeroanoata}:`, error.message)
    }
  }

  // Relatório final
  console.log('\n' + '='.repeat(60))
  console.log('📊 RELATÓRIO FINAL DE MIGRAÇÃO')
  console.log('='.repeat(60))
  console.log(`📋 Total de sessões administrativas identificadas: ${sessoesAdministrativas.length}`)
  console.log(`✅ Sessões migradas com sucesso: ${migradas}`)
  console.log(`❌ Erros durante a migração: ${erros}`)
  console.log(`📈 Taxa de sucesso: ${sessoesAdministrativas.length > 0 ? ((migradas / sessoesAdministrativas.length) * 100).toFixed(1) : 0}%`)

  if (errosDetalhados.length > 0) {
    console.log('\n📋 Detalhes dos erros:')
    errosDetalhados.forEach((erro, index) => {
      console.log(`\n${index + 1}. Ata: ${erro.ata}`)
      console.log(`   Erro: ${erro.erro}`)
      console.log(`   Dados: ${JSON.stringify(erro.dados, null, 2)}`)
    })
  }


  console.log('\n🎉 Migração de sessões administrativas concluída!')
}

main()
  .catch((e) => {
    console.error('💥 Erro fatal durante a migração:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })