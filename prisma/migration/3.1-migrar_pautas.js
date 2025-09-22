// node prisma/migration/3.1-migrar_pautas.js

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

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
  } catch (error) {
    return null
  }
}

// Função para encontrar ou criar contribuinte
async function findOrCreateContribuinte(contribuinteData) {
  try {
    // Primeiro tenta encontrar por CPF/CNPJ
    let contribuinte = await prisma.contribuinte.findFirst({
      where: { cpfCnpj: contribuinteData.cpfCnpj }
    })

    if (contribuinte) return contribuinte

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

    console.log(`✅ Contribuinte criado: ${contribuinte.nome} (${contribuinte.cpfCnpj})`)
    return contribuinte
  } catch (error) {
    console.error(`❌ Erro ao criar contribuinte ${contribuinteData.nome}:`, error.message)
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
    return 'DEFERIDO' // Padrão para casos sem decisão especificada
  }

  const decisaoNormalizada = normalizeString(decisao)

  if (decisaoNormalizada.includes('indeferido') || decisaoNormalizada.includes('negado')) {
    return 'INDEFERIDO'
  } else if (decisaoNormalizada.includes('parcial')) {
    return 'PARCIAL'
  } else {
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
        // Verificar se o processo já existe
        const processoExistente = await prisma.processo.findFirst({
          where: { numero: processoData.numero }
        })

        if (processoExistente) {
          console.log(`⏭️  Processo já existe: ${processoData.numero}`)
          continue
        }

        // Encontrar ou criar contribuinte
        const contribuinte = await findOrCreateContribuinte(processoData.contribuinte)
        if (!contribuinte) {
          console.error(`❌ Não foi possível criar contribuinte para processo ${processoData.numero}`)
          continue
        }

        // Criar processo
        const novoProcesso = await prisma.processo.create({
          data: {
            numero: processoData.numero,
            tipo: processoData.tipo,
            contribuinteId: contribuinte.id,
            dataAbertura: new Date(processoData.dataAbertura),
            status: 'EM_ANALISE',
            observacoes: processoData.observacoes
          }
        })

        // Criar histórico do processo
        await prisma.historicoProcesso.create({
          data: {
            processoId: novoProcesso.id,
            usuarioId: usuarioSistema.id,
            titulo: 'Processo criado por migração',
            descricao: `Processo ${novoProcesso.numero} criado durante migração de dados antigos`,
            tipo: 'ABERTURA',
            createdAt: new Date(processoData.dataAbertura)
          }
        })

        // Criar log de auditoria para criação do processo
        await prisma.logAuditoria.create({
          data: {
            usuarioId: usuarioSistema.id,
            acao: 'CREATE',
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
            createdAt: new Date(processoData.dataAbertura)
          }
        })

        console.log(`✅ Processo criado: ${novoProcesso.numero} (ID: ${novoProcesso.id})`)

        // Verificar imediatamente se foi criado corretamente
        const verificacao = await prisma.processo.findFirst({
          where: { numero: processoData.numero }
        })

        if (verificacao) {
          console.log(`   ✅ Verificação: Processo ${processoData.numero} confirmado no banco`)
        } else {
          console.log(`   ❌ Verificação: Processo ${processoData.numero} NÃO encontrado após criação!`)
        }

        processosAdicionados++

      } catch (error) {
        console.error(`❌ Erro ao criar processo ${processoData.numero}:`, error.message)
      }
    }

    console.log(`\n✅ Processos faltantes criados: ${processosAdicionados}`)
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

        const dataPauta = new Date(ata.dataata)
        const dia = String(dataPauta.getDate()).padStart(2, '0')
        const mes = String(dataPauta.getMonth() + 1).padStart(2, '0')
        const ano = dataPauta.getFullYear()
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
        const processosJaAdicionados = new Set()

        for (const procData of ata.processos) {
          const processo = await prisma.processo.findFirst({
            where: { numero: procData.numeroprocesso },
            include: { contribuinte: true }
          })

          if (processo && !processosJaAdicionados.has(processo.id)) {
            processosValidos.push({
              processo,
              relator: procData.relator,
              revisor: procData.revisor,
              resultado: procData.resultado,
              decisao: procData.decisao,
              textoAta: procData.textoata
            })
            processosJaAdicionados.add(processo.id)
          } else if (processo && processosJaAdicionados.has(processo.id)) {
            console.log(`⚠️  Processo duplicado ignorado: ${procData.numeroprocesso}`)
          } else {
            console.log(`❌ Processo não encontrado: ${procData.numeroprocesso}`)
            processosNaoEncontradosDetalhados.push({
              numeroProcesso: procData.numeroprocesso,
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
              acao: 'UPDATE',
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
            acao: 'CREATE',
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
      console.log('- Crie os processos manualmente se necessário antes de reexecutar')
    }

    return { pautasCriadas, erros, processosNaoEncontrados: processosNaoEncontradosDetalhados }

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
    const verificacaoInicial = await verificarDadosInicial()

    if (!verificacaoInicial.podeProsseguir) {
      console.log('\n❌ MIGRAÇÃO INTERROMPIDA!')
      console.log('Há problemas nos dados que impedem a migração segura.')
      console.log('Resolva os problemas identificados antes de continuar.')
      return
    }

    console.log('\n✅ Verificação inicial concluída - conselheiros encontrados!')

    // ETAPA 2: Criar processos faltantes
    const processosFaltantes = await criarProcessosFaltantes()

    // ETAPA 3: Verificação final dos dados (após criar processos faltantes)
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

    // Mostrar processos não encontrados para verificação (após criação dos faltantes)
    if (verificacaoFinal.processosNaoEncontrados && verificacaoFinal.processosNaoEncontrados.length > 0) {
      console.log('\n📋 ===== PROCESSOS AINDA NÃO ENCONTRADOS =====')
      console.log('Os seguintes processos não foram encontrados no banco de dados:')
      console.log('=================================================')
      verificacaoFinal.processosNaoEncontrados.forEach((numero, index) => {
        console.log(`${index + 1}. ${numero}`)
      })
      console.log('\n💡 Sugestões:')
      console.log('- Verifique se estes processos foram criados com números diferentes')
      console.log('- Confirme se já foram migrados em execuções anteriores')
      console.log('- Adicione-os manualmente se necessário')
    }

    if (migracao.erros === 0) {
      console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
    } else {
      console.log('\n⚠️  Migração concluída com alguns erros. Verifique os logs acima.')
    }

    // Retornar dados para análise externa se necessário
    return {
      processosNaoEncontradosVerificacao: verificacaoFinal.processosNaoEncontrados || [],
      processosNaoEncontradosMigracao: migracao.processosNaoEncontrados || [],
      conselheirosNaoEncontrados: verificacaoInicial.conselheirosNaoEncontrados || [],
      processosFaltantesCriados: processosFaltantes.processosAdicionados,
      pautasMigradas: migracao.pautasCriadas,
      erros: migracao.erros
    }

  } catch (error) {
    console.error('💥 Erro fatal na migração:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar migração completa
if (require.main === module) {
  executarMigracaoCompleta()
    .then(() => {
      console.log('\n🏁 Script finalizado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Erro fatal:', error)
      process.exit(1)
    })
}

module.exports = {
  verificarDadosInicial,
  verificarDados,
  criarProcessosFaltantes,
  migrarPautas,
  executarMigracaoCompleta
}