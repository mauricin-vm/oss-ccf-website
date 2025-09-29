// node prisma/migration/0.1-criar-conselheiros.js

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * Script para criar conselheiros no banco de dados
 * Executa apenas se os conselheiros não existirem
 */

const conselheiros = [
  { nome: 'Adrianne Cristina Coelho Lobo' },
  { nome: 'Adriano Trevejo Zanotti' },
  { nome: 'Arthur Vieira de Oliveira Lavôr' },
  { nome: 'Cecília Saad Cruz Rizkallah' },
  { nome: 'Claudemir De Lima Silva' },
  { nome: 'Cláudia de Araújo Melo' },
  { nome: 'Danilo Isaias Boa Ventura' },
  { nome: 'Denir de Souza Nantes' },
  { nome: 'Emerson Augusto Maeda Taira' },
  { nome: 'Francimar Messias Assis Júnior' },
  { nome: 'Jorge Takeshi Otubo' },
  { nome: 'Isabela Batista Machado Soares Scaramal' },
  { nome: 'Larissa Cardoso' },
  { nome: 'Larissa Zirbes Faria' },
  { nome: 'Letícia Sousa de Moura' },
  { nome: 'Luís Alexandre Holak' },
  { nome: 'Luís Eduardo Costa' },
  { nome: 'Kátia Silene Sarturi Warde' },
  { nome: 'Mariana Rodrigues Moreira' },
  { nome: 'Paulo Roberto Barros da Silva' },
  { nome: 'Paulo Victor Medeiros Damasceno' },
  { nome: 'Pedro Sol Milhomem Santos Ferreira' },
  { nome: 'Ricardo Vieira Dias' },
  { nome: 'Rosemeire Aparecida Cristaldo Palmeira' },
  { nome: 'Ronney Alencar Moreira' },
  { nome: 'Sinomar Tiago Rodrigues' },
  { nome: 'Thales Emanoel Azevedo' },
  { nome: 'Victor Pereira Afonso' }
]

async function criarConselheiros() {
  console.log('🚀 Iniciando criação de conselheiros...')

  try {
    let contadorCriados = 0
    let contadorExistentes = 0

    for (const conselheiroData of conselheiros) {
      // Verificar se o conselheiro já existe
      const conselheiroExistente = await prisma.conselheiro.findFirst({
        where: {
          nome: {
            equals: conselheiroData.nome,
            mode: 'insensitive'
          }
        }
      })

      if (conselheiroExistente) {
        console.log(`ℹ️  Conselheiro já existe: ${conselheiroData.nome}`)
        contadorExistentes++
      } else {
        // Criar o conselheiro
        await prisma.conselheiro.create({
          data: {
            nome: conselheiroData.nome,
            ativo: true,
            origem: 'Sistema'
          }
        })
        console.log(`✅ Conselheiro criado: ${conselheiroData.nome}`)
        contadorCriados++
      }
    }

    console.log('\n📊 Resumo da execução:')
    console.log(`✅ Conselheiros criados: ${contadorCriados}`)
    console.log(`ℹ️  Conselheiros já existentes: ${contadorExistentes}`)
    console.log(`📝 Total de conselheiros processados: ${conselheiros.length}`)

    // Verificar total de conselheiros ativos no sistema
    const totalConselheiros = await prisma.conselheiro.count({
      where: { ativo: true }
    })
    console.log(`🏛️  Total de conselheiros ativos no sistema: ${totalConselheiros}`)

  } catch (error) {
    console.error('❌ Erro ao criar conselheiros:', error)
    throw error
  }
}

async function main() {
  try {
    await criarConselheiros()
    console.log('\n🎉 Migração concluída com sucesso!')
  } catch (error) {
    console.error('\n💥 Erro durante a migração:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar se o script for chamado diretamente
if (require.main === module) {
  main()
}

module.exports = { criarConselheiros }