// node prisma/migration/3.1-migrar_pautas.js

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Dados dos processos faltantes embarcados no script
const PROCESSOS_FALTANTES = {
  "processos": [
    {
      "numero": "37436/2025-11",
      "tipo": "TRANSACAO_EXCEPCIONAL",
      "contribuinte": {
        "nome": "Centro Educacional Alceu Viana LTDA",
        "cpfCnpj": "37557733000131",
        "email": "escolaalceuviana@gmail.com",
        "telefone": "67992246468/6730422944",
        "endereco": "Avenida Nosso Senhor do Bonfim, 655, Bairro Parque dos Novos Estados",
        "cidade": "Campo Grande",
        "estado": "MS",
        "cep": "79034000"
      },
      "dataAbertura": "2025-07-22",
      "observacoes": "Processo cadastrado durante migração por falta de informação no banco de dados antigo."
    },
    {
      "numero": "31056/2025-72",
      "tipo": "TRANSACAO_EXCEPCIONAL",
      "contribuinte": {
        "nome": "Fabiana Silva dos Santos",
        "cpfCnpj": "89281179687",
        "email": "fabianasantos@nwadv.com.br",
        "telefone": "67992698987/67999951122",
        "endereco": "Rua Goiás, 461, Jardim dos Estados",
        "cidade": "Campo Grande",
        "estado": "MS",
        "cep": "79020100"
      },
      "dataAbertura": "2025-06-27",
      "observacoes": "Processo cadastrado durante migração por falta de informação no banco de dados antigo."
    },
    {
      "numero": "35815/2025-76",
      "tipo": "TRANSACAO_EXCEPCIONAL",
      "contribuinte": {
        "nome": "André Luiz Scaff",
        "cpfCnpj": "36736970130",
        "email": "",
        "telefone": "",
        "endereco": "Rua Filodrendo, n. 90, Damha I",
        "cidade": "Campo Grande",
        "estado": "MS",
        "cep": "79046138"
      },
      "dataAbertura": "2025-07-15",
      "observacoes": "Processo cadastrado durante migração por falta de informação no banco de dados antigo."
    },
    {
      "numero": "35115/2025-81",
      "tipo": "TRANSACAO_EXCEPCIONAL",
      "contribuinte": {
        "nome": "Master Class Participações e Assessoria LTDA",
        "cpfCnpj": "09152386000121",
        "email": "administrativo@masterclasspar.com.br",
        "telefone": "6733271501",
        "endereco": "Avenida Afonso Pena, n. 2440, sala 121, Vila Cidade",
        "cidade": "Campo Grande",
        "estado": "MS",
        "cep": "79002074"
      },
      "dataAbertura": "2025-07-11",
      "observacoes": "Processo cadastrado durante migração por falta de informação no banco de dados antigo."
    },
    {
      "numero": "35265/2025-95",
      "tipo": "TRANSACAO_EXCEPCIONAL",
      "contribuinte": {
        "nome": "BRASHOP S/A",
        "cpfCnpj": "03262205000133",
        "email": "jjaromeroadv@hotmail.com",
        "telefone": "67998441562",
        "endereco": "Avenida Consul Assaf Trad, n. 1456",
        "cidade": "Campo Grande",
        "estado": "MS",
        "cep": ""
      },
      "dataAbertura": "2025-07-11",
      "observacoes": "Processo cadastrado durante migração por falta de informação no banco de dados antigo."
    }
  ],
  "usuarioCriador": {
    "email": "migracao_ccf@gov.br",
    "comentario": "Coloque aqui o email do usuário que deve aparecer como criador dos processos"
  }
}

// Função para normalizar nomes
function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// Função para encontrar conselheiro por nome
async function findConselheiroByName(nomeCompleto) {
  try {
    let conselheiro = await prisma.conselheiro.findFirst({
      where: {
        nome: {
          equals: nomeCompleto,
          mode: 'insensitive'
        }
      }
    })

    if (conselheiro) return conselheiro

    const partesNome = nomeCompleto.split(' ')
    if (partesNome.length >= 2) {
      const primeiroSegundoNome = `${partesNome[0]} ${partesNome[1]}`
      conselheiro = await prisma.conselheiro.findFirst({
        where: {
          nome: {
            contains: primeiroSegundoNome,
            mode: 'insensitive'
          }
        }
      })
      if (conselheiro) return conselheiro
    }

    for (const parte of partesNome) {
      if (parte.length > 3) {
        conselheiro = await prisma.conselheiro.findFirst({
          where: {
            nome: {
              contains: parte,
              mode: 'insensitive'
            }
          }
        })
        if (conselheiro) return conselheiro
      }
    }

    return null
  } catch {
    return null
  }
}

// Função para encontrar ou criar contribuinte
async function findOrCreateContribuinte(contribuinteData) {
  try {
    console.log(`     🔍 Buscando contribuinte por CPF/CNPJ: ${contribuinteData.cpfCnpj}`)

    // Primeiro tenta encontrar por CPF/CNPJ
    let contribuinte = await prisma.contribuinte.findFirst({
      where: { cpfCnpj: contribuinteData.cpfCnpj }
    })

    if (contribuinte) {
      console.log(`     ✅ Contribuinte já existe: ${contribuinte.nome} (ID: ${contribuinte.id})`)
      return contribuinte
    }

    console.log(`     🔧 Contribuinte não existe, criando novo...`)

    // Validar dados obrigatórios
    if (!contribuinteData.nome || !contribuinteData.cpfCnpj) {
      console.error(`     ❌ Dados obrigatórios faltando: nome=${contribuinteData.nome}, cpfCnpj=${contribuinteData.cpfCnpj}`)
      return null
    }

    // Se não encontrar, cria novo contribuinte
    contribuinte = await prisma.contribuinte.create({
      data: {
        nome: contribuinteData.nome,
        cpfCnpj: contribuinteData.cpfCnpj,
        email: contribuinteData.email || '',
        telefone: contribuinteData.telefone || '',
        endereco: contribuinteData.endereco || '',
        cidade: contribuinteData.cidade || '',
        estado: contribuinteData.estado || '',
        cep: contribuinteData.cep || ''
      }
    })

    console.log(`     ✅ Contribuinte criado: ${contribuinte.nome} (${contribuinte.cpfCnpj}) - ID: ${contribuinte.id}`)
    return contribuinte
  } catch (error) {
    console.error(`     ❌ Erro ao criar contribuinte ${contribuinteData.nome}:`, error.message)
    console.error(`     ❌ Detalhes do erro:`, error)
    console.error(`     ❌ Dados que causaram erro:`, JSON.stringify(contribuinteData, null, 2))
    return null
  }
}

// Função para converter resultado para TipoResultadoJulgamento
function convertResultadoToEnum(resultado) {
  const mappings = {
    'suspenso': 'SUSPENSO',
    'pedido de vista': 'PEDIDO_VISTA',
    'pedido de diligência': 'PEDIDO_DILIGENCIA',
    'pedido de diligencia': 'PEDIDO_DILIGENCIA',
    'em negociação': 'EM_NEGOCIACAO',
    'em negociacao': 'EM_NEGOCIACAO',
    'julgado': 'JULGADO'
  }

  const resultadoNormalizado = normalizeString(resultado)

  for (const [key, value] of Object.entries(mappings)) {
    if (resultadoNormalizado.includes(normalizeString(key))) {
      return value
    }
  }

  console.log(`⚠️  Resultado não mapeado: "${resultado}" - usando JULGADO como padrão`)
  return 'JULGADO'
}

// Função para converter decisão para TipoDecisao
function convertDecisaoToEnum(decisao) {
  if (!decisao || decisao.trim() === '') {
    return null // Retorna null para casos sem decisão especificada
  }

  const decisaoNormalizada = normalizeString(decisao)

  // Mapear exatamente os valores possíveis do JSON
  if (decisaoNormalizada.includes('indeferimento') || decisaoNormalizada.includes('indeferido')) {
    return 'INDEFERIDO'
  } else if (decisaoNormalizada.includes('deferimento parcial') || decisaoNormalizada.includes('parcial')) {
    return 'PARCIAL'
  } else if (decisaoNormalizada.includes('deferimento') || decisaoNormalizada.includes('deferido')) {
    return 'DEFERIDO'
  } else {
    // Para valores não mapeados, usar DEFERIDO como padrão
    console.log(`⚠️  Decisão não mapeada: "${decisao}" - usando DEFERIDO como padrão`)
    return 'DEFERIDO'
  }
}

// 1. VERIFICAÇÃO INICIAL DOS DADOS (APENAS CONSELHEIROS)
async function verificarDadosInicial() {
  try {
    console.log('🔍 === ETAPA 1: VERIFICAÇÃO INICIAL (CONSELHEIROS) ===\n')

    const dataPath = path.join(__dirname, '3.0-data-old-db.json')

    if (!fs.existsSync(dataPath)) {
      throw new Error(`❌ Arquivo de dados não encontrado: ${dataPath}`)
    }

    const rawData = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(rawData)

    console.log(`📁 Total de sessões: ${data.atas.length}`)

    const sessesComProcessos = data.atas.filter(ata => ata.processos && ata.processos.length > 0)
    console.log(`📋 Sessões com processos: ${sessesComProcessos.length}`)

    const conselheirosUnicos = new Set()

    for (const ata of sessesComProcessos) {
      conselheirosUnicos.add(ata.presidente)
      ata.conselheirosparticipantes.forEach(c => conselheirosUnicos.add(c))

      ata.processos.forEach(proc => {
        conselheirosUnicos.add(proc.relator)
        if (proc.revisor && proc.revisor.trim()) {
          conselheirosUnicos.add(proc.revisor)
        }
      })
    }

    console.log(`👥 Conselheiros únicos mencionados: ${conselheirosUnicos.size}`)

    // Verificar conselheiros no banco
    console.log('\n👥 Verificando conselheiros...')
    const conselheirosNaoEncontrados = []
    let conselheirosEncontrados = 0

    for (const nomeConselheiro of conselheirosUnicos) {
      const conselheiro = await findConselheiroByName(nomeConselheiro)
      if (conselheiro) {
        conselheirosEncontrados++
      } else {
        conselheirosNaoEncontrados.push(nomeConselheiro)
      }
    }

    console.log(`✅ Conselheiros encontrados: ${conselheirosEncontrados}/${conselheirosUnicos.size}`)

    if (conselheirosNaoEncontrados.length > 0) {
      console.log('\n❌ Conselheiros NÃO encontrados:')
      conselheirosNaoEncontrados.forEach(nome => {
        console.log(`  - ${nome}`)
      })
    }

    console.log('\n📊 RESUMO DA VERIFICAÇÃO INICIAL:')
    console.log('==================================')
    console.log(`✅ Sessões prontas para migração: ${sessesComProcessos.length}`)
    console.log(`${conselheirosNaoEncontrados.length === 0 ? '✅' : '⚠️'} Conselheiros: ${conselheirosEncontrados}/${conselheirosUnicos.size} encontrados`)

    return {
      sessesComProcessos,
      conselheirosNaoEncontrados,
      podeProsseguir: conselheirosNaoEncontrados.length === 0
    }

  } catch (error) {
    console.error('❌ Erro na verificação inicial:', error)
    return { podeProsseguir: false }
  }
}

// 2. VERIFICAÇÃO COMPLETA DOS DADOS (APÓS CRIAR PROCESSOS FALTANTES)
async function verificarDados() {
  try {
    console.log('🔍 === ETAPA 3: VERIFICAÇÃO FINAL DOS DADOS ===\n')

    const dataPath = path.join(__dirname, '3.0-data-old-db.json')

    if (!fs.existsSync(dataPath)) {
      throw new Error(`❌ Arquivo de dados não encontrado: ${dataPath}`)
    }

    const rawData = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(rawData)

    console.log(`📁 Total de sessões: ${data.atas.length}`)

    const sessesComProcessos = data.atas.filter(ata => ata.processos && ata.processos.length > 0)
    console.log(`📋 Sessões com processos: ${sessesComProcessos.length}`)

    let totalProcessos = 0
    const conselheirosUnicos = new Set()
    const processosUnicos = new Set()
    const resultadosUnicos = new Set()

    for (const ata of sessesComProcessos) {
      totalProcessos += ata.processos.length

      conselheirosUnicos.add(ata.presidente)
      ata.conselheirosparticipantes.forEach(c => conselheirosUnicos.add(c))

      ata.processos.forEach(proc => {
        processosUnicos.add(proc.numeroprocesso)
        conselheirosUnicos.add(proc.relator)
        if (proc.revisor && proc.revisor.trim()) {
          conselheirosUnicos.add(proc.revisor)
        }
        resultadosUnicos.add(proc.resultado)
      })
    }

    console.log(`📊 Total de processos a migrar: ${totalProcessos}`)
    console.log(`👥 Conselheiros únicos mencionados: ${conselheirosUnicos.size}`)
    console.log(`📄 Processos únicos: ${processosUnicos.size}`)

    console.log('\n📋 Tipos de resultado encontrados:')
    Array.from(resultadosUnicos).sort().forEach(resultado => {
      console.log(`  - ${resultado}`)
    })

    // Verificar conselheiros no banco
    console.log('\n👥 Verificando conselheiros...')
    const conselheirosNaoEncontrados = []
    let conselheirosEncontrados = 0

    for (const nomeConselheiro of conselheirosUnicos) {
      const conselheiro = await findConselheiroByName(nomeConselheiro)
      if (conselheiro) {
        conselheirosEncontrados++
      } else {
        conselheirosNaoEncontrados.push(nomeConselheiro)
      }
    }

    console.log(`✅ Conselheiros encontrados: ${conselheirosEncontrados}/${conselheirosUnicos.size}`)

    if (conselheirosNaoEncontrados.length > 0) {
      console.log('\n❌ Conselheiros NÃO encontrados:')
      conselheirosNaoEncontrados.forEach(nome => {
        console.log(`  - ${nome}`)
      })
    }

    // Verificar processos no banco
    console.log('\n📄 Verificando processos...')
    const processosNaoEncontrados = []
    let processosEncontrados = 0

    for (const numeroProcesso of processosUnicos) {
      const processo = await prisma.processo.findFirst({
        where: { numero: numeroProcesso }
      })

      if (processo) {
        processosEncontrados++
      } else {
        processosNaoEncontrados.push(numeroProcesso)
      }
    }

    console.log(`✅ Processos encontrados: ${processosEncontrados}/${processosUnicos.size}`)

    if (processosNaoEncontrados.length > 0) {
      console.log('\n❌ Processos NÃO encontrados:')
      processosNaoEncontrados.slice(0, 10).forEach(numero => {
        console.log(`  - ${numero}`)
      })
      if (processosNaoEncontrados.length > 10) {
        console.log(`  ... e mais ${processosNaoEncontrados.length - 10} processos`)
      }

      // Debug: Verificar se são os mesmos 5 processos que deveriam ter sido criados
      console.log('\n🔍 DEBUG: Verificando se são os processos faltantes que deveriam ter sido criados:')
      const numerosFaltantes = PROCESSOS_FALTANTES.processos.map(p => p.numero)
      processosNaoEncontrados.forEach(numero => {
        if (numerosFaltantes.includes(numero)) {
          console.log(`  🔴 ${numero} - DEVERIA ter sido criado automaticamente!`)
        } else {
          console.log(`  🟡 ${numero} - Processo diferente dos faltantes embarcados`)
        }
      })
    }

    // Verificar se há pautas já migradas
    console.log('\n🔍 Verificando pautas existentes...')
    const pautasExistentes = await prisma.pauta.count({
      where: {
        observacoes: {
          contains: 'migração automática'
        }
      }
    })

    console.log(`📋 Pautas já migradas: ${pautasExistentes}`)

    console.log('\n📊 RESUMO DA VERIFICAÇÃO FINAL:')
    console.log('=================================')
    console.log(`✅ Sessões prontas para migração: ${sessesComProcessos.length}`)
    console.log(`✅ Total de processos: ${totalProcessos}`)
    console.log(`${conselheirosNaoEncontrados.length === 0 ? '✅' : '⚠️'} Conselheiros: ${conselheirosEncontrados}/${conselheirosUnicos.size} encontrados`)
    console.log(`${processosNaoEncontrados.length === 0 ? '✅' : '⚠️'} Processos: ${processosEncontrados}/${processosUnicos.size} encontrados`)
    console.log(`📋 Pautas já migradas: ${pautasExistentes}`)

    if (processosNaoEncontrados.length === 0) {
      console.log('\n🎉 Todos os processos foram encontrados! Pronto para migração.')
    }

    return {
      sessesComProcessos,
      processosNaoEncontrados,
      conselheirosNaoEncontrados,
      podeProsseguir: conselheirosNaoEncontrados.length === 0
    }

  } catch (error) {
    console.error('❌ Erro na verificação:', error)
    return { podeProsseguir: false }
  }
}

// 2. CRIAÇÃO DE PROCESSOS FALTANTES
async function criarProcessosFaltantes() {
  try {
    console.log('\n🔧 === ETAPA 2: CRIANDO PROCESSOS FALTANTES ===\n')
    console.log('🚨 DEBUG: Função criarProcessosFaltantes() foi chamada!')

    const processosFaltantes = PROCESSOS_FALTANTES

    console.log(`📄 Processos faltantes a criar: ${processosFaltantes.processos.length}`)

    // Debug: Mostrar quais processos serão criados
    console.log('\n🔍 DEBUG: Processos que serão criados:')
    processosFaltantes.processos.forEach((proc, index) => {
      console.log(`  ${index + 1}. ${proc.numero} - ${proc.contribuinte.nome}`)
    })

    // Buscar usuário do sistema
    const usuarioSistema = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    })

    if (!usuarioSistema) {
      throw new Error('❌ Nenhum usuário ADMIN encontrado no sistema')
    }

    let processosAdicionados = 0

    for (const processoData of processosFaltantes.processos) {
      try {
        console.log(`\n🔍 Processando: ${processoData.numero}`)

        // Verificar se o processo já existe
        console.log(`   🔍 Verificando se processo já existe...`)
        const processoExistente = await prisma.processo.findFirst({
          where: { numero: processoData.numero }
        })

        if (processoExistente) {
          console.log(`⏭️  Processo já existe: ${processoData.numero} (ID: ${processoExistente.id})`)
          continue
        }

        console.log(`   ✅ Processo não existe, pode ser criado`)

        // Encontrar ou criar contribuinte
        console.log(`   🔍 Buscando/criando contribuinte: ${processoData.contribuinte.nome} (${processoData.contribuinte.cpfCnpj})`)
        const contribuinte = await findOrCreateContribuinte(processoData.contribuinte)
        if (!contribuinte) {
          console.error(`❌ Não foi possível criar contribuinte para processo ${processoData.numero}`)
          console.error(`   Dados do contribuinte:`, JSON.stringify(processoData.contribuinte, null, 2))
          continue
        }

        console.log(`   ✅ Contribuinte OK: ${contribuinte.nome} (ID: ${contribuinte.id})`)

        // Criar processo
        console.log(`   🔧 Criando processo...`)
        console.log(`   Dados: numero=${processoData.numero}, tipo=${processoData.tipo}, contribuinteId=${contribuinte.id}`)

        const novoProcesso = await prisma.processo.create({
          data: {
            numero: processoData.numero,
            tipo: processoData.tipo,
            contribuinteId: contribuinte.id,
            createdById: usuarioSistema.id, // Campo obrigatório que estava faltando!
            dataAbertura: new Date(processoData.dataAbertura),
            status: 'EM_ANALISE',
            observacoes: processoData.observacoes
          }
        })

        console.log(`   ✅ Processo criado com sucesso: ${novoProcesso.numero} (ID: ${novoProcesso.id})`)

        // Criar histórico do processo
        await prisma.historicoProcesso.create({
          data: {
            processoId: novoProcesso.id,
            usuarioId: usuarioSistema.id,
            titulo: 'Processo criado por migração',
            descricao: `Processo ${novoProcesso.numero} criado durante migração de dados antigos`,
            tipo: 'ABERTURA',
            createdAt: (() => { const d = new Date(processoData.dataAbertura); d.setHours(12, 0, 0, 0); return d; })()
          }
        })

        // Criar log de auditoria para criação do processo
        await prisma.logAuditoria.create({
          data: {
            usuarioId: usuarioSistema.id,
            acao: 'MIGRATE',
            entidade: 'Processo',
            entidadeId: novoProcesso.id,
            dadosNovos: {
              numero: novoProcesso.numero,
              tipo: novoProcesso.tipo,
              contribuinte: contribuinte.nome,
              dataAbertura: novoProcesso.dataAbertura,
              migracao: true,
              observacoes: novoProcesso.observacoes
            },
            createdAt: (() => { const d = new Date(processoData.dataAbertura); d.setHours(12, 0, 0, 0); return d; })()
          }
        })

        console.log(`✅ Processo criado: ${novoProcesso.numero} (ID: ${novoProcesso.id})`)

        // Verificar imediatamente se foi criado corretamente
        const verificacao = await prisma.processo.findFirst({
          where: { numero: processoData.numero }
        })

        if (verificacao) {
          console.log(`   ✅ Verificação: Processo ${processoData.numero} confirmado no banco (ID: ${verificacao.id})`)
        } else {
          console.log(`   ❌ Verificação: Processo ${processoData.numero} NÃO encontrado após criação!`)
        }

        // Verificar também com busca case-insensitive (igual à migração de pautas)
        const verificacaoCaseInsensitive = await prisma.processo.findFirst({
          where: {
            numero: {
              equals: processoData.numero,
              mode: 'insensitive'
            }
          }
        })

        if (verificacaoCaseInsensitive) {
          console.log(`   ✅ Verificação case-insensitive: ${processoData.numero} encontrado (ID: ${verificacaoCaseInsensitive.id})`)
        } else {
          console.log(`   ❌ Verificação case-insensitive: ${processoData.numero} NÃO encontrado!`)
        }

        processosAdicionados++
        console.log(`   🎉 Processo ${processoData.numero} criado e configurado com sucesso!`)

      } catch (error) {
        console.error(`❌ Erro CRÍTICO ao criar processo ${processoData.numero}:`)
        console.error(`   Mensagem: ${error.message}`)
        console.error(`   Stack trace:`, error.stack)
        console.error(`   Dados do processo:`, JSON.stringify(processoData, null, 2))
      }
    }

    console.log(`\n📊 === RESUMO DA CRIAÇÃO DE PROCESSOS FALTANTES ===`)
    console.log(`📄 Total configurado para criar: ${processosFaltantes.processos.length}`)
    console.log(`✅ Processos criados com sucesso: ${processosAdicionados}`)
    console.log(`❌ Processos que falharam: ${processosFaltantes.processos.length - processosAdicionados}`)

    if (processosAdicionados === 0) {
      console.log(`\n⚠️  NENHUM processo foi criado! Possíveis causas:`)
      console.log(`- Todos os processos já existem no banco`)
      console.log(`- Erros na criação de contribuintes`)
      console.log(`- Problemas de validação de dados`)
      console.log(`- Erros de banco de dados`)
    } else if (processosAdicionados < processosFaltantes.processos.length) {
      console.log(`\n⚠️  Alguns processos não foram criados. Verifique os erros acima.`)
    } else {
      console.log(`\n🎉 Todos os processos faltantes foram criados com sucesso!`)
    }

    // Garantir que todas as transações foram commitadas
    console.log('💾 Forçando sincronização do banco de dados...')
    await prisma.$executeRaw`SELECT 1` // Query simples para forçar flush

    return { processosAdicionados }

  } catch (error) {
    console.error('❌ Erro na criação de processos faltantes:', error)
    return { processosAdicionados: 0 }
  }
}

// 3. MIGRAÇÃO DAS PAUTAS
async function migrarPautas() {
  try {
    console.log('\n🚀 === ETAPA 3: MIGRANDO PAUTAS ===\n')

    const dataPath = path.join(__dirname, '3.0-data-old-db.json')
    const rawData = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(rawData)

    const sessesComProcessos = data.atas.filter(ata => ata.processos && ata.processos.length > 0)
    console.log(`📋 Sessões com processos para migrar: ${sessesComProcessos.length}`)

    let pautasCriadas = 0
    let erros = 0
    const processosNaoEncontradosDetalhados = []
    const processosDuplicados = [] // Rastrear processos duplicados por pauta

    const usuarioSistema = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    })

    if (!usuarioSistema) {
      throw new Error('❌ Nenhum usuário ADMIN encontrado no sistema')
    }

    console.log(`👤 Usando usuário "${usuarioSistema.name}" como criador das pautas`)

    for (const ata of sessesComProcessos) {
      try {
        console.log(`\n📝 Processando ata: ${ata.numeroanoata} (${ata.dataata})`)

        const [recDia, recMes, recAno] = ata.dataata.split("/"); // "23/09/2025"
        // Criar data em UTC para evitar problemas de timezone
        const dataPauta = new Date(Date.UTC(parseInt(recAno), parseInt(recMes) - 1, parseInt(recDia), 12, 0, 0, 0))

        // Usar a data original para o nome da pauta (antes de qualquer manipulação)
        const dia = recDia.padStart(2, '0')
        const mes = recMes.padStart(2, '0')
        const ano = recAno
        const numeroPauta = `Pauta ${dia}-${mes}-${ano} - ${ata.numeroanoata}`

        // Verificar se já existe
        const pautaExistente = await prisma.pauta.findUnique({
          where: { numero: numeroPauta }
        })

        if (pautaExistente) {
          console.log(`⏭️  Pauta já existe: ${numeroPauta}`)
          continue
        }

        // Buscar e validar processos
        const processosValidos = []
        const processosJaAdicionadosNestaPauta = new Set() // Apenas para esta pauta específica

        for (const procData of ata.processos) {
          // Limpar e normalizar número do processo
          const numeroProcessoLimpo = procData.numeroprocesso?.toString().trim()

          if (!numeroProcessoLimpo) {
            console.log(`⚠️  Número de processo vazio ou inválido na ata ${ata.numeroanoata}`)
            continue
          }

          console.log(`🔍 Buscando processo: "${numeroProcessoLimpo}"`)

          // Tentar busca exata primeiro
          let processo = await prisma.processo.findFirst({
            where: { numero: numeroProcessoLimpo },
            include: { contribuinte: true }
          })

          // Se não encontrou, tentar busca case-insensitive
          if (!processo) {
            console.log(`   Tentando busca case-insensitive...`)
            processo = await prisma.processo.findFirst({
              where: {
                numero: {
                  equals: numeroProcessoLimpo,
                  mode: 'insensitive'
                }
              },
              include: { contribuinte: true }
            })
          }

          // Se ainda não encontrou, tentar busca por contenção (pode ter espaços extras)
          if (!processo) {
            console.log(`   Tentando busca por contenção...`)
            processo = await prisma.processo.findFirst({
              where: {
                numero: {
                  contains: numeroProcessoLimpo.replace(/\s+/g, ''),
                  mode: 'insensitive'
                }
              },
              include: { contribuinte: true }
            })
          }

          // Debug: listar processos similares se não encontrou
          if (!processo) {
            console.log(`   🔍 DEBUG: Buscando processos similares...`)
            const numeroBase = numeroProcessoLimpo.split('/')[0] // Pegar só a parte antes da barra
            if (numeroBase) {
              const processosSimilares = await prisma.processo.findMany({
                where: {
                  numero: {
                    contains: numeroBase,
                    mode: 'insensitive'
                  }
                },
                select: { numero: true, id: true },
                take: 5
              })

              if (processosSimilares.length > 0) {
                console.log(`   📋 Processos similares encontrados:`)
                processosSimilares.forEach(p => {
                  console.log(`      - ${p.numero} (ID: ${p.id})`)
                })
              } else {
                console.log(`   📋 Nenhum processo similar encontrado com base "${numeroBase}"`)
              }
            }
          }

          if (processo && !processosJaAdicionadosNestaPauta.has(processo.id)) {
            console.log(`✅ Processo encontrado: ${processo.numero} (ID: ${processo.id})`)
            processosValidos.push({
              processo,
              relator: procData.relator,
              revisor: procData.revisor,
              resultado: procData.resultado,
              decisao: procData.decisao,
              textoAta: procData.textoata
            })
            processosJaAdicionadosNestaPauta.add(processo.id)
          } else if (processo && processosJaAdicionadosNestaPauta.has(processo.id)) {
            console.log(`⚠️  Processo duplicado ignorado: ${procData.numeroprocesso} (ID: ${processo.id})`)
            console.log(`   Motivo: Este processo já apareceu anteriormente na mesma pauta/ata`)

            // Registrar detalhes da duplicata
            processosDuplicados.push({
              numeroProcesso: procData.numeroprocesso,
              processoId: processo.id,
              ata: ata.numeroanoata,
              dataAta: ata.dataata,
              numeroPauta: numeroPauta,
              relator: procData.relator,
              revisor: procData.revisor,
              resultado: procData.resultado,
              contribuinte: processo.contribuinte?.nome
            })
          } else {
            console.log(`❌ Processo NÃO encontrado após todas as tentativas: "${numeroProcessoLimpo}"`)
            console.log(`   JSON original: "${procData.numeroprocesso}"`)
            console.log(`   Ata: ${ata.numeroanoata}`)
            console.log(`   Relator: ${procData.relator}`)

            processosNaoEncontradosDetalhados.push({
              numeroProcesso: procData.numeroprocesso,
              numeroProcessoLimpo: numeroProcessoLimpo,
              ata: ata.numeroanoata,
              dataAta: ata.dataata,
              relator: procData.relator,
              revisor: procData.revisor,
              resultado: procData.resultado,
              decisao: procData.decisao
            })
          }
        }

        if (processosValidos.length === 0) {
          console.log(`⚠️  Nenhum processo válido encontrado para ata ${ata.numeroanoata}`)
          continue
        }

        processosValidos.sort((a, b) => a.relator.localeCompare(b.relator))

        // Buscar presidente
        const presidente = await findConselheiroByName(ata.presidente)
        if (!presidente) {
          console.error(`❌ Presidente não encontrado: ${ata.presidente}`)
          erros++
          continue
        }

        // Buscar conselheiros participantes
        const conselheirosParticipantes = []
        for (const nomeConselheiro of ata.conselheirosparticipantes) {
          const conselheiro = await findConselheiroByName(nomeConselheiro)
          if (conselheiro) {
            conselheirosParticipantes.push(conselheiro.id)
          }
        }

        // Criar pauta
        const pauta = await prisma.pauta.create({
          data: {
            numero: numeroPauta,
            dataPauta: dataPauta,
            observacoes: 'Pauta criada por migração automática de dados.',
            status: 'fechada',
            createdAt: dataPauta,
            updatedAt: dataPauta
          }
        })

        console.log(`✅ Pauta criada: ${pauta.numero}`)

        // Mapear conselheiros antes de criar ProcessoPauta
        const conselheirosMap = new Map()
        for (const procValido of processosValidos) {
          if (!conselheirosMap.has(procValido.relator)) {
            conselheirosMap.set(procValido.relator, await findConselheiroByName(procValido.relator))
          }
          if (procValido.revisor && procValido.revisor.trim() && !conselheirosMap.has(procValido.revisor)) {
            conselheirosMap.set(procValido.revisor, await findConselheiroByName(procValido.revisor))
          }
        }

        // Criar ProcessoPauta para cada processo
        for (let i = 0; i < processosValidos.length; i++) {
          const procValido = processosValidos[i]

          // Verificar se ProcessoPauta já existe
          const processoPautaExistente = await prisma.processoPauta.findUnique({
            where: {
              processoId_pautaId: {
                processoId: procValido.processo.id,
                pautaId: pauta.id
              }
            }
          })

          if (processoPautaExistente) {
            console.log(`⚠️  ProcessoPauta já existe: ${procValido.processo.numero} na pauta ${pauta.numero}`)
            continue
          }

          const relatorConselheiro = conselheirosMap.get(procValido.relator)
          const revisorConselheiro = procValido.revisor && procValido.revisor.trim() ? conselheirosMap.get(procValido.revisor) : null

          const revisores = []
          if (revisorConselheiro) {
            revisores.push(revisorConselheiro.nome)
          }

          // Criar ProcessoPauta com resultado da sessão
          const statusSessaoEnum = convertResultadoToEnum(procValido.resultado)

          await prisma.processoPauta.create({
            data: {
              processoId: procValido.processo.id,
              pautaId: pauta.id,
              ordem: i + 1,
              relator: relatorConselheiro ? relatorConselheiro.nome : procValido.relator,
              distribuidoPara: relatorConselheiro ? relatorConselheiro.nome : procValido.relator,
              revisores: revisores,
              statusSessao: statusSessaoEnum,
              // Registrar informações específicas da sessão
              ataTexto: procValido.textoAta || null,
              observacoesSessao: procValido.decisao || null,
              // Campos específicos por tipo de resultado
              motivoSuspensao: statusSessaoEnum === 'SUSPENSO' ? 'Processo suspenso durante migração de dados' : null,
              prazoVista: statusSessaoEnum === 'PEDIDO_VISTA' ? dataPauta : null,
              prazoDiligencia: statusSessaoEnum === 'PEDIDO_DILIGENCIA' ? 15 : null // 15 dias padrão
            }
          })
        }

        // Criar sessão de julgamento
        const sessao = await prisma.sessaoJulgamento.create({
          data: {
            tipoSessao: 'JULGAMENTO',
            pautaId: pauta.id,
            dataInicio: dataPauta,
            dataFim: dataPauta,
            presidenteId: presidente.id,
            conselheiros: {
              connect: conselheirosParticipantes.map(id => ({ id }))
            },
            ata: `Ata ${ata.numeroanoata} - Migrada automaticamente`,
            createdAt: dataPauta,
            updatedAt: dataPauta
          }
        })

        // Atualizar status dos processos baseado no resultado
        for (const procValido of processosValidos) {
          const statusEnum = convertResultadoToEnum(procValido.resultado)
          let novoStatus = 'EM_ANALISE'

          if (statusEnum === 'JULGADO') {
            novoStatus = 'JULGADO'
          } else if (statusEnum === 'PEDIDO_VISTA') {
            novoStatus = 'PEDIDO_VISTA'
          } else if (statusEnum === 'EM_NEGOCIACAO') {
            novoStatus = 'EM_NEGOCIACAO'
          } else if (statusEnum === 'SUSPENSO') {
            novoStatus = 'SUSPENSO'
          } else if (statusEnum === 'PEDIDO_DILIGENCIA') {
            novoStatus = 'PEDIDO_DILIGENCIA'
          }

          await prisma.processo.update({
            where: { id: procValido.processo.id },
            data: { status: novoStatus }
          })
        }

        // Criar históricos e tramitações
        for (const procValido of processosValidos) {
          const distribucaoInfo = procValido.relator ? ` - Distribuído para: ${procValido.relator}` : ''

          // Histórico de inclusão na pauta
          await prisma.historicoProcesso.create({
            data: {
              processoId: procValido.processo.id,
              usuarioId: usuarioSistema.id,
              titulo: 'Processo incluído em pauta',
              descricao: `Processo incluído na ${numeroPauta} agendada para ${dataPauta.toLocaleDateString('pt-BR')}${distribucaoInfo}`,
              tipo: 'PAUTA',
              createdAt: dataPauta
            }
          })

          // Histórico específico do resultado do julgamento (30 minutos após inclusão na pauta)
          const dataResultado = new Date(dataPauta.getTime() + 30 * 60 * 1000) // +30 minutos
          const statusEnum = convertResultadoToEnum(procValido.resultado)
          let tituloResultado = 'Resultado do julgamento'
          let descricaoResultado = `Processo julgado na ${numeroPauta} em ${dataPauta.toLocaleDateString('pt-BR')}.`

          if (statusEnum === 'JULGADO') {
            descricaoResultado += ` Resultado: ${procValido.resultado}`
            if (procValido.decisao) {
              descricaoResultado += ` - Decisão: ${procValido.decisao}`
            }
            if (procValido.textoAta) {
              descricaoResultado += ` - Ata: ${procValido.textoAta}`
            }
          } else if (statusEnum === 'PEDIDO_VISTA') {
            tituloResultado = 'Pedido de vista'
            descricaoResultado += ` Resultado: Pedido de vista solicitado.`
          } else if (statusEnum === 'EM_NEGOCIACAO') {
            tituloResultado = 'Processo em negociação'
            descricaoResultado += ` Resultado: Processo encaminhado para negociação.`
          } else if (statusEnum === 'SUSPENSO') {
            tituloResultado = 'Processo suspenso'
            descricaoResultado += ` Resultado: Processo suspenso.`
          } else if (statusEnum === 'PEDIDO_DILIGENCIA') {
            tituloResultado = 'Pedido de diligência'
            descricaoResultado += ` Resultado: Pedido de diligência solicitado.`
          }

          if (procValido.relator) {
            descricaoResultado += ` Relator: ${procValido.relator}.`
          }
          if (procValido.revisor) {
            descricaoResultado += ` Revisor: ${procValido.revisor}.`
          }

          await prisma.historicoProcesso.create({
            data: {
              processoId: procValido.processo.id,
              usuarioId: usuarioSistema.id,
              titulo: tituloResultado,
              descricao: descricaoResultado,
              tipo: 'JULGAMENTO',
              createdAt: dataResultado
            }
          })

          // Tramitação
          if (procValido.relator) {
            await prisma.tramitacao.create({
              data: {
                processoId: procValido.processo.id,
                usuarioId: usuarioSistema.id,
                setorOrigem: 'CCF',
                setorDestino: procValido.relator,
                dataEnvio: dataPauta,
                dataRecebimento: dataPauta,
                prazoResposta: dataPauta,
                observacoes: `Processo distribuído na ${numeroPauta} para julgamento em ${dataPauta.toLocaleDateString('pt-BR')}. Resultado: ${procValido.resultado}${procValido.revisor ? ` - Revisor: ${procValido.revisor}` : ''}`
              }
            })
          }

          // Para todos os tipos de resultado, criar decisão (não apenas JULGADO)
          const tipoDecisao = statusEnum === 'JULGADO' ? convertDecisaoToEnum(procValido.decisao) : null

          // Criar decisão para todos os resultados
          const textoObservacoes = []
          if (procValido.textoAta && procValido.textoAta.trim()) {
            textoObservacoes.push(`Ata: ${procValido.textoAta}`)
          }
          if (procValido.decisao && procValido.decisao.trim()) {
            textoObservacoes.push(`Decisão: ${procValido.decisao}`)
          }
          textoObservacoes.push(`Processo ${procValido.resultado.toLowerCase()} na ${numeroPauta} em ${dataPauta.toLocaleDateString('pt-BR')}`)

          // Dados específicos por tipo de resultado
          const dadosDecisao = {
            processoId: procValido.processo.id,
            sessaoId: sessao.id,
            tipoResultado: statusEnum,
            tipoDecisao: tipoDecisao,
            observacoes: textoObservacoes.join('. '),
            dataDecisao: dataResultado,
            // Campos específicos
            motivoSuspensao: statusEnum === 'SUSPENSO' ? 'Processo suspenso durante migração de dados' : null,
            conselheiroPedidoVista: statusEnum === 'PEDIDO_VISTA' && procValido.revisor ? procValido.revisor : null,
            prazoVista: statusEnum === 'PEDIDO_VISTA' ? dataPauta : null,
            especificacaoDiligencia: statusEnum === 'PEDIDO_DILIGENCIA' ? 'Diligência solicitada durante migração' : null,
            prazoDiligencia: statusEnum === 'PEDIDO_DILIGENCIA' ? 15 : null
          }

          const decisao = await prisma.decisao.create({
            data: dadosDecisao
          })

          // Para processos julgados, criar votos
          if (statusEnum === 'JULGADO') {
            const relatorConselheiro = conselheirosMap.get(procValido.relator)
            const revisorConselheiro = procValido.revisor && procValido.revisor.trim() ? conselheirosMap.get(procValido.revisor) : null

            // Criar voto do relator
            await prisma.voto.create({
              data: {
                decisaoId: decisao.id,
                conselheiroId: relatorConselheiro?.id,
                tipoVoto: 'RELATOR',
                nomeVotante: procValido.relator,
                textoVoto: `Voto do relator: ${tipoDecisao}`,
                posicaoVoto: tipoDecisao,
                ordemApresentacao: 1,
                isPresidente: false
              }
            })

            // Criar voto do revisor (se existir)
            if (revisorConselheiro) {
              await prisma.voto.create({
                data: {
                  decisaoId: decisao.id,
                  conselheiroId: revisorConselheiro.id,
                  tipoVoto: 'REVISOR',
                  nomeVotante: procValido.revisor,
                  textoVoto: `Voto do revisor acompanhando o relator: ${tipoDecisao}`,
                  posicaoVoto: tipoDecisao,
                  acompanhaVoto: 'relator',
                  ordemApresentacao: 2,
                  isPresidente: false
                }
              })
            }

            // Criar votos dos conselheiros participantes (todos acompanham o relator)
            let ordemVoto = revisorConselheiro ? 3 : 2
            for (const conselheiroId of conselheirosParticipantes) {
              // Não votar se for o próprio relator ou revisor
              if (conselheiroId === relatorConselheiro?.id || conselheiroId === revisorConselheiro?.id) {
                continue
              }

              const conselheiro = await prisma.conselheiro.findUnique({
                where: { id: conselheiroId }
              })

              if (conselheiro) {
                const isPresidenteVotando = conselheiroId === presidente.id

                await prisma.voto.create({
                  data: {
                    decisaoId: decisao.id,
                    conselheiroId: conselheiroId,
                    tipoVoto: 'CONSELHEIRO',
                    nomeVotante: conselheiro.nome,
                    textoVoto: `Conselheiro acompanha o voto do relator: ${tipoDecisao}`,
                    posicaoVoto: tipoDecisao,
                    acompanhaVoto: 'relator',
                    ordemApresentacao: ordemVoto,
                    isPresidente: isPresidenteVotando
                  }
                })
                ordemVoto++
              }
            }

            console.log(`    📊 Decisão criada com ${ordemVoto - 1} votos registrados`)
          }

          // Log de auditoria específico do resultado
          await prisma.logAuditoria.create({
            data: {
              usuarioId: usuarioSistema.id,
              acao: 'MIGRATE',
              entidade: 'Processo',
              entidadeId: procValido.processo.id,
              dadosNovos: {
                numeroProcesso: procValido.processo.numero,
                resultado: procValido.resultado,
                decisao: procValido.decisao,
                textoAta: procValido.textoAta,
                relator: procValido.relator,
                revisor: procValido.revisor,
                statusAnterior: procValido.processo.status,
                novoStatus: statusEnum,
                pauta: numeroPauta,
                dataSessao: dataPauta,
                migracao: true
              },
              createdAt: dataPauta
            }
          })
        }

        // Criar histórico da pauta
        await prisma.historicoPauta.create({
          data: {
            pautaId: pauta.id,
            usuarioId: usuarioSistema.id,
            titulo: 'Pauta criada por migração',
            descricao: `Pauta ${numeroPauta} criada por migração com ${processosValidos.length} processo${processosValidos.length !== 1 ? 's' : ''} para julgamento em ${dataPauta.toLocaleDateString('pt-BR')}. Ata original: ${ata.numeroanoata}`,
            tipo: 'CRIACAO',
            createdAt: dataPauta
          }
        })

        for (const procValido of processosValidos) {
          const distribucaoInfo = procValido.relator ? ` - Distribuído para: ${procValido.relator}` : ''

          await prisma.historicoPauta.create({
            data: {
              pautaId: pauta.id,
              usuarioId: usuarioSistema.id,
              titulo: 'Processo adicionado',
              descricao: `Processo ${procValido.processo.numero} incluído na pauta${distribucaoInfo}`,
              tipo: 'PROCESSO_ADICIONADO',
              createdAt: dataPauta
            }
          })
        }

        // Criar log de auditoria
        await prisma.logAuditoria.create({
          data: {
            usuarioId: usuarioSistema.id,
            acao: 'MIGRATE',
            entidade: 'Pauta',
            entidadeId: pauta.id,
            dadosNovos: {
              numero: pauta.numero,
              dataPauta: pauta.dataPauta,
              totalProcessos: processosValidos.length,
              migracao: true,
              ataOriginal: ata.numeroanoata,
              processos: processosValidos.map(p => ({
                numero: p.processo.numero,
                contribuinte: p.processo.contribuinte.nome,
                relator: p.relator,
                revisor: p.revisor,
                resultado: p.resultado
              }))
            },
            createdAt: dataPauta
          }
        })

        console.log(`✅ Pauta completa: ${pauta.numero}`)
        console.log(`📋 Sessão criada: ${sessao.id}`)
        console.log(`📊 Processos migrados: ${processosValidos.length}`)

        pautasCriadas++

      } catch (error) {
        console.error(`❌ Erro ao processar ata ${ata.numeroanoata}:`, error.message)
        erros++
      }
    }

    // Coletar estatísticas dos resultados
    const estatisticasResultados = {}
    const processosComRevisor = []
    const todosProcessos = []
    let totalVotosCriados = 0
    let totalDecisoesCriadas = 0

    // Processar dados para estatísticas
    for (const ata of sessesComProcessos) {
      for (const procData of ata.processos) {
        const resultado = procData.resultado
        estatisticasResultados[resultado] = (estatisticasResultados[resultado] || 0) + 1

        // Coletar todos os processos
        todosProcessos.push({
          numero: procData.numeroprocesso,
          relator: procData.relator,
          revisor: procData.revisor && procData.revisor.trim() ? procData.revisor : null,
          resultado: procData.resultado,
          ata: ata.numeroanoata,
          dataAta: ata.dataata
        })

        // Processos especificamente com revisor
        if (procData.revisor && procData.revisor.trim()) {
          processosComRevisor.push({
            numero: procData.numeroprocesso,
            relator: procData.relator,
            revisor: procData.revisor,
            resultado: procData.resultado,
            ata: ata.numeroanoata,
            dataAta: ata.dataata
          })
        }

        // Contar decisões e votos que serão criados
        totalDecisoesCriadas++ // Decisão criada para todos os tipos de resultado

        if (convertResultadoToEnum(resultado) === 'JULGADO') {
          // Relator sempre vota
          totalVotosCriados++
          // Revisor vota se existir
          if (procData.revisor && procData.revisor.trim()) {
            totalVotosCriados++
          }
          // Conselheiros participantes (estimativa: conselheiros - relator - revisor)
          const conselheirosParticipantesEstimativa = ata.conselheirosparticipantes ? ata.conselheirosparticipantes.length : 0
          totalVotosCriados += Math.max(0, conselheirosParticipantesEstimativa - (procData.revisor ? 2 : 1))
        }
      }
    }

    console.log(`\n🎉 Migração de pautas concluída!`)
    console.log(`================================`)
    console.log(`✅ Pautas criadas: ${pautasCriadas}`)
    console.log(`📋 Sessões de julgamento criadas: ${pautasCriadas}`)
    console.log(`⚖️  Decisões criadas: ${totalDecisoesCriadas}`)
    console.log(`🗳️  Votos registrados: ${totalVotosCriados}`)
    console.log(`❌ Erros: ${erros}`)

    // Relatório de processos duplicados
    if (processosDuplicados.length > 0) {
      console.log(`\n📋 ===== PROCESSOS DUPLICADOS IGNORADOS =====`)
      console.log(`Total: ${processosDuplicados.length} duplicatas encontradas`)
      console.log('===========================================')

      // Agrupar por pauta para melhor visualização
      const duplicatasPorPauta = {}
      processosDuplicados.forEach(proc => {
        if (!duplicatasPorPauta[proc.numeroPauta]) {
          duplicatasPorPauta[proc.numeroPauta] = []
        }
        duplicatasPorPauta[proc.numeroPauta].push(proc)
      })

      Object.entries(duplicatasPorPauta).forEach(([pauta, duplicatas]) => {
        console.log(`\n📝 ${pauta}:`)
        duplicatas.forEach((proc, index) => {
          console.log(`  ${index + 1}. ${proc.numeroProcesso} - ${proc.contribuinte}`)
          console.log(`     Relator: ${proc.relator}`)
          console.log(`     Revisor: ${proc.revisor || 'N/A'}`)
          console.log(`     Resultado: ${proc.resultado}`)
        })
      })

      console.log('\n💡 Explicação:')
      console.log('- Estes processos apareceram múltiplas vezes na mesma pauta/ata')
      console.log('- As duplicatas foram ignoradas para evitar registros redundantes')
      console.log('- O processo foi mantido apenas na primeira ocorrência dentro da pauta')
    }

    console.log(`\n📊 ESTATÍSTICAS DOS RESULTADOS:`)
    console.log(`===============================`)
    Object.entries(estatisticasResultados).forEach(([resultado, count]) => {
      console.log(`${resultado}: ${count} processos`)
    })

    // Separar processos com e sem revisor
    const processosSemRevisor = todosProcessos.filter(p => !p.revisor)

    console.log(`\n📋 RESUMO DE RELATORES E REVISORES:`)
    console.log(`=====================================`)
    console.log(`📊 Total de processos: ${todosProcessos.length}`)
    console.log(`👤 Processos apenas com relator: ${processosSemRevisor.length}`)
    console.log(`👥 Processos com relator e revisor: ${processosComRevisor.length}`)

    if (processosComRevisor.length > 0) {
      console.log(`\n👥 PROCESSOS COM RELATOR E REVISOR (${processosComRevisor.length} encontrados):`)
      console.log(`====================================================`)
      processosComRevisor.forEach((proc, index) => {
        console.log(`\n${index + 1}. Processo: ${proc.numero}`)
        console.log(`   Ata: ${proc.ata} (${proc.dataAta})`)
        console.log(`   👤 Relator: ${proc.relator}`)
        console.log(`   👥 Revisor: ${proc.revisor}`)
        console.log(`   📋 Resultado: ${proc.resultado}`)
      })
      console.log(`\n💡 IMPORTANTE: Verifique se os revisores foram corretamente identificados.`)
      console.log(`Os revisores são registrados no campo 'revisores' das pautas criadas.`)
      console.log(`Para processos julgados, ambos (relator e revisor) têm votos registrados.`)
    }

    if (processosSemRevisor.length > 0) {
      console.log(`\n👤 PROCESSOS APENAS COM RELATOR (${processosSemRevisor.length} encontrados):`)
      console.log(`==============================================`)
      processosSemRevisor.slice(0, 10).forEach((proc, index) => {
        console.log(`${index + 1}. ${proc.numero} - Relator: ${proc.relator} (${proc.resultado})`)
      })
      if (processosSemRevisor.length > 10) {
        console.log(`... e mais ${processosSemRevisor.length - 10} processos`)
      }
    }

    // Exibir processos não encontrados detalhadamente
    if (processosNaoEncontradosDetalhados.length > 0) {
      console.log(`\n📋 ===== PROCESSOS NÃO ENCONTRADOS DURANTE MIGRAÇÃO =====`)
      console.log(`Total: ${processosNaoEncontradosDetalhados.length} processos`)
      console.log('========================================================')
      processosNaoEncontradosDetalhados.forEach((proc, index) => {
        console.log(`\n${index + 1}. Processo: ${proc.numeroProcesso}`)
        if (proc.numeroProcessoLimpo && proc.numeroProcessoLimpo !== proc.numeroProcesso) {
          console.log(`   Número limpo: ${proc.numeroProcessoLimpo}`)
        }
        console.log(`   Ata: ${proc.ata} (${proc.dataAta})`)
        console.log(`   Relator: ${proc.relator}`)
        console.log(`   Revisor: ${proc.revisor || 'N/A'}`)
        console.log(`   Resultado: ${proc.resultado}`)
        if (proc.decisao) {
          console.log(`   Decisão: ${proc.decisao}`)
        }
      })
      console.log('\n💡 Ações recomendadas:')
      console.log('- Verifique se estes processos existem com números ligeiramente diferentes')
      console.log('- Confirme se foram criados em migrações anteriores')
      console.log('- Execute uma consulta manual no banco: SELECT numero FROM Processo WHERE numero LIKE \'%NUMERO_BASE%\'')
      console.log('- Verifique se há diferenças de formatação (espaços, barras, hífens)')
      console.log('- Crie os processos manualmente se necessário antes de reexecutar')

      // Sugestão de consulta SQL para debug
      console.log('\n🔍 DEBUG: Consultas SQL recomendadas:')
      const numerosUnicos = [...new Set(processosNaoEncontradosDetalhados.map(p => p.numeroProcesso))]
      numerosUnicos.slice(0, 3).forEach(numero => {
        const numeroBase = numero.split('/')[0]
        console.log(`   SELECT numero FROM Processo WHERE numero LIKE '%${numeroBase}%';`)
      })
      if (numerosUnicos.length > 3) {
        console.log(`   ... e mais ${numerosUnicos.length - 3} consultas similares`)
      }
    }

    return {
      pautasCriadas,
      erros,
      processosNaoEncontrados: processosNaoEncontradosDetalhados,
      processosDuplicados: processosDuplicados
    }

  } catch (error) {
    console.error('❌ Erro geral na migração de pautas:', error)
    return { pautasCriadas: 0, erros: 1 }
  }
}

// FUNÇÃO PRINCIPAL QUE EXECUTA TUDO
async function executarMigracaoCompleta() {
  try {
    console.log('🎯 ===== MIGRAÇÃO COMPLETA DE PAUTAS =====\n')
    console.log('Este script irá:')
    console.log('1. Verificar conselheiros necessários')
    console.log('2. Criar processos faltantes automaticamente')
    console.log('3. Verificar se todos os processos estão prontos')
    console.log('4. Migrar as pautas das atas')
    console.log('\n==========================================\n')

    // ETAPA 1: Verificação inicial (apenas conselheiros)
    console.log('🔍 === ETAPA 1: VERIFICAÇÃO INICIAL ===')
    const verificacaoInicial = await verificarDadosInicial()

    if (!verificacaoInicial.podeProsseguir) {
      console.log('\n❌ MIGRAÇÃO INTERROMPIDA!')
      console.log('Há problemas nos dados que impedem a migração segura.')
      console.log('Resolva os problemas identificados antes de continuar.')
      return
    }

    console.log('\n✅ Verificação inicial concluída - conselheiros encontrados!')

    // ETAPA 2: Criar processos faltantes
    console.log('\n🚀 Iniciando ETAPA 2: Criação de processos faltantes...')
    const processosFaltantes = await criarProcessosFaltantes()
    console.log(`🏁 ETAPA 2 concluída! Resultado: ${processosFaltantes.processosAdicionados} processos criados`)

    // Aguardar um pouco para garantir que o banco foi atualizado
    console.log('⏳ Aguardando 2 segundos para sincronização do banco...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verificação imediata: confirmar que os processos foram realmente criados
    console.log('🔍 Verificando se os processos faltantes foram realmente criados...')
    for (const procData of PROCESSOS_FALTANTES.processos) {
      const verificacao = await prisma.processo.findFirst({
        where: { numero: procData.numero }
      })
      if (verificacao) {
        console.log(`   ✅ ${procData.numero} confirmado no banco (ID: ${verificacao.id})`)
      } else {
        console.log(`   ❌ ${procData.numero} NÃO encontrado no banco!`)
      }
    }

    // ETAPA 3: Verificação final dos dados (após criar processos faltantes)
    console.log('\n🔍 === ETAPA 3: VERIFICAÇÃO FINAL ===')
    const verificacaoFinal = await verificarDados()

    console.log('\n✅ Verificação final concluída - dados prontos para migração!')

    // ETAPA 4: Migrar pautas
    const migracao = await migrarPautas()

    // RESUMO FINAL
    console.log('\n🏆 ===== RESUMO FINAL DA MIGRAÇÃO =====')
    console.log('=====================================')
    console.log(`📄 Processos faltantes criados: ${processosFaltantes.processosAdicionados}`)
    console.log(`📋 Pautas migradas: ${migracao.pautasCriadas}`)
    console.log(`❌ Erros na migração: ${migracao.erros}`)

    // Debug: mostrar quais processos faltantes foram criados
    if (processosFaltantes.processosAdicionados > 0) {
      console.log('\n📄 PROCESSOS FALTANTES QUE FORAM CRIADOS:')
      console.log('=========================================')
      PROCESSOS_FALTANTES.processos.forEach((proc, index) => {
        console.log(`${index + 1}. ${proc.numero} - ${proc.contribuinte.nome}`)
      })
    }

    // Mostrar apenas processos que realmente não foram encontrados DURANTE A MIGRAÇÃO
    if (migracao.processosNaoEncontrados && migracao.processosNaoEncontrados.length > 0) {
      console.log('\n📋 ===== PROCESSOS NÃO ENCONTRADOS DURANTE A MIGRAÇÃO =====')
      console.log('Os seguintes processos não foram encontrados durante a criação das pautas:')
      console.log('================================================================')

      // Agrupar por ata para melhor visualização
      const processosPorAta = {}
      migracao.processosNaoEncontrados.forEach(proc => {
        if (!processosPorAta[proc.ata]) {
          processosPorAta[proc.ata] = []
        }
        processosPorAta[proc.ata].push(proc)
      })

      let totalProcessosNaoEncontrados = 0
      Object.entries(processosPorAta).forEach(([ata, processos]) => {
        console.log(`\nAta ${ata} (${processos[0].dataAta}):`)
        processos.forEach((proc) => {
          totalProcessosNaoEncontrados++
          console.log(`  ${totalProcessosNaoEncontrados}. ${proc.numeroProcesso} - Relator: ${proc.relator} - Resultado: ${proc.resultado}`)
        })
      })

      console.log(`\nTotal: ${totalProcessosNaoEncontrados} processos não encontrados`)

      // Verificação cruzada: quais destes deveriam ter sido criados pelos PROCESSOS_FALTANTES
      const numerosFaltantes = PROCESSOS_FALTANTES.processos.map(p => p.numero)
      const processosQueDeveriamTerSidoCriados = migracao.processosNaoEncontrados.filter(proc =>
        numerosFaltantes.includes(proc.numeroProcesso)
      )

      if (processosQueDeveriamTerSidoCriados.length > 0) {
        console.log('\n🔴 CRÍTICO: Processos que DEVERIAM ter sido criados automaticamente:')
        console.log('=============================================================')
        processosQueDeveriamTerSidoCriados.forEach((proc, index) => {
          console.log(`${index + 1}. ${proc.numeroProcesso} - Era para ter sido criado na ETAPA 2!`)
        })
        console.log('\n🚨 AÇÃO NECESSÁRIA: Verifique por que a criação automática falhou!')
      }

      console.log('\n💡 Sugestões:')
      console.log('- Estes processos existiam na verificação inicial mas não foram encontrados durante a migração')
      console.log('- Verifique se há diferenças de formatação no número do processo')
      console.log('- Execute uma busca manual no banco para confirmar a existência')
      console.log('- Considere executar os scripts de migração de processos novamente')
    } else {
      console.log('\n✅ Todos os processos das pautas foram encontrados e migrados com sucesso!')
    }

    if (migracao.erros === 0) {
      console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
    } else {
      console.log('\n⚠️  Migração concluída com alguns erros. Verifique os logs acima.')
    }

    // Retornar dados para análise externa se necessário
    return {
      // Dados principais da migração
      pautasMigradas: migracao.pautasCriadas,
      erros: migracao.erros,
      processosFaltantesCriados: processosFaltantes.processosAdicionados,

      // Problemas encontrados (apenas os que realmente falharam na migração)
      processosNaoEncontradosNaMigracao: migracao.processosNaoEncontrados || [],
      conselheirosNaoEncontrados: verificacaoInicial.conselheirosNaoEncontrados || [],

      // Para debug/comparação (não exibidos no log final)
      processosNaoEncontradosNaVerificacao: verificacaoFinal.processosNaoEncontrados || []
    }

  } catch (error) {
    console.error('💥 Erro fatal na migração:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar migração completa
if (require.main === module) {
  console.log('🚨 DEBUG: Script 3.1-migrar_pautas.js foi executado!')
  console.log('🚨 DEBUG: Iniciando executarMigracaoCompleta()...')

  executarMigracaoCompleta()
    .then(() => {
      console.log('\n🏁 Script finalizado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Erro fatal:', error)
      process.exit(1)
    })
} else {
  console.log('🚨 DEBUG: Script foi importado como módulo, não executado diretamente')
}

export {
  verificarDadosInicial,
  verificarDados,
  criarProcessosFaltantes,
  migrarPautas,
  executarMigracaoCompleta
}