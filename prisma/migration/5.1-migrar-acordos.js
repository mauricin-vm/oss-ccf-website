// node prisma/migration/5.1-migrar-acordos.js

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

// Função para normalizar valores numéricos
function parseValue(value) {
  if (!value || value === '') return 0
  if (typeof value === 'string') {
    return parseFloat(value.replace(',', '.')) || 0
  }
  return Number(value) || 0
}

// Função para encontrar processo por número
async function findProcessoByNumero(numeroProcesso) {
  try {
    const processo = await prisma.processo.findFirst({
      where: { numero: numeroProcesso },
      include: {
        contribuinte: true,
        acordos: {
          orderBy: { createdAt: 'desc' }
        },
        decisoes: {
          orderBy: { dataDecisao: 'desc' },
          take: 1
        }
      }
    })
    return processo
  } catch (error) {
    console.error(`Erro ao buscar processo ${numeroProcesso}:`, error.message)
    return null
  }
}

// Função para gerar número do termo
async function gerarNumeroTermo() {
  const ano = new Date().getFullYear()
  const ultimoAcordo = await prisma.acordo.findFirst({
    where: {
      numeroTermo: {
        contains: `/${ano}`
      }
    },
    orderBy: { numeroTermo: 'desc' }
  })

  let proximoNumero = 1
  if (ultimoAcordo) {
    const ultimoNumero = parseInt(ultimoAcordo.numeroTermo.split('/')[0])
    proximoNumero = ultimoNumero + 1
  }

  return `${proximoNumero.toString().padStart(4, '0')}/${ano}`
}


// Função para criar parcelas de transação na migração (baseado na API atual)
async function criarParcelasTransacaoMigracao(tx, acordoId, propostaFinal, dataVencimento) {
  const parcelas = []

  if (propostaFinal.metodoPagamento === 'parcelado' && propostaFinal.quantidadeParcelas > 1) {
    const valorEntrada = propostaFinal.valorEntrada || 0
    const valorParaParcelas = propostaFinal.valorTotalProposto - valorEntrada
    const valorParcela = valorParaParcelas / propostaFinal.quantidadeParcelas

    // Se há entrada, criar parcela de entrada
    if (valorEntrada > 0) {
      const dataVencimentoEntrada = new Date(dataVencimento)
      dataVencimentoEntrada.setHours(12, 0, 0, 0)
      parcelas.push({
        acordoId: acordoId,
        tipoParcela: 'ENTRADA',
        numero: 0,
        valor: valorEntrada,
        dataVencimento: dataVencimentoEntrada,
        status: 'PENDENTE'
      })
    }

    // Criar parcelas do acordo
    for (let i = 1; i <= propostaFinal.quantidadeParcelas; i++) {
      const dataVencimentoParcela = new Date(dataVencimento)
      dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i) // Primeira parcela 1 mês depois
      dataVencimentoParcela.setHours(12, 0, 0, 0)

      parcelas.push({
        acordoId: acordoId,
        tipoParcela: 'PARCELA_ACORDO',
        numero: i,
        valor: i === propostaFinal.quantidadeParcelas
          ? valorParaParcelas - (valorParcela * (propostaFinal.quantidadeParcelas - 1)) // Ajustar última parcela
          : valorParcela,
        dataVencimento: dataVencimentoParcela,
        status: 'PENDENTE'
      })
    }
  } else {
    // Pagamento à vista
    const dataVencimentoAvista = new Date(dataVencimento)
    dataVencimentoAvista.setHours(12, 0, 0, 0)
    parcelas.push({
      acordoId: acordoId,
      tipoParcela: 'PARCELA_ACORDO',
      numero: 1,
      valor: propostaFinal.valorTotalProposto,
      dataVencimento: dataVencimentoAvista,
      status: 'PENDENTE'
    })
  }

  // Criar parcelas de honorários se existirem
  if (propostaFinal.honorariosValor && propostaFinal.honorariosValor > 0) {
    const dataVencimentoHonorarios = new Date(dataVencimento)
    dataVencimentoHonorarios.setHours(12, 0, 0, 0)

    parcelas.push({
      acordoId: acordoId,
      tipoParcela: 'PARCELA_HONORARIOS',
      numero: 1,
      valor: propostaFinal.honorariosValor,
      dataVencimento: dataVencimentoHonorarios,
      status: 'PENDENTE'
    })
  }

  // Criar todas as parcelas
  for (const parcela of parcelas) {
    await tx.parcela.create({
      data: parcela
    })
  }
}

// Função principal de migração
async function migrarAcordos() {
  try {
    console.log('🚀 === MIGRAÇÃO DE ACORDOS ===\n')

    // Carregar dados do arquivo JSON
    const dataPath = path.join(__dirname, '5.0-acordos-migracao.json')
    if (!fs.existsSync(dataPath)) {
      throw new Error(`❌ Arquivo de dados não encontrado: ${dataPath}`)
    }

    const rawData = fs.readFileSync(dataPath, 'utf8')
    const data = JSON.parse(rawData)

    if (!data.acordos || !Array.isArray(data.acordos)) {
      throw new Error('❌ Dados de acordos não encontrados no arquivo JSON')
    }

    console.log(`📊 Total de acordos para migrar: ${data.acordos.length}`)

    // Buscar usuário do sistema para histórico
    const usuarioSistema = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    })

    if (!usuarioSistema) {
      throw new Error('❌ Nenhum usuário ADMIN encontrado no sistema')
    }

    let acordosCriados = 0
    let erros = 0
    const errosDetalhados = []
    const processosNaoEncontrados = []
    const processosNaoElegiveis = []
    const acordosJaExistentes = []

    for (const [index, acordoData] of data.acordos.entries()) {
      try {
        console.log(`\n[${index + 1}/${data.acordos.length}] Processando acordo para processo: ${acordoData.processoNumero}`)

        // Validar dados obrigatórios
        if (!acordoData.processoNumero || !acordoData.dataAssinatura) {
          throw new Error(`Dados obrigatórios faltando: processoNumero=${acordoData.processoNumero}, dataAssinatura=${acordoData.dataAssinatura}`)
        }

        // Buscar processo
        const processo = await findProcessoByNumero(acordoData.processoNumero)
        if (!processo) {
          processosNaoEncontrados.push({
            processoNumero: acordoData.processoNumero,
            valorFinal: acordoData.valorFinal
          })
          throw new Error(`Processo não encontrado: ${acordoData.processoNumero}`)
        }

        console.log(`✅ Processo encontrado: ${processo.numero} - ${processo.contribuinte?.nome}`)

        // Verificar se processo é elegível
        if (processo.status !== 'JULGADO') {
          processosNaoElegiveis.push({
            processoNumero: acordoData.processoNumero,
            contribuinte: processo.contribuinte?.nome,
            statusAtual: processo.status,
            motivo: 'Processo não está julgado'
          })
          throw new Error(`Processo não está julgado: status=${processo.status}`)
        }

        // Verificar decisão favorável
        if (!processo.decisoes || processo.decisoes.length === 0) {
          processosNaoElegiveis.push({
            processoNumero: acordoData.processoNumero,
            contribuinte: processo.contribuinte?.nome,
            statusAtual: processo.status,
            motivo: 'Processo não possui decisões registradas'
          })
          throw new Error('Processo não possui decisões registradas')
        }

        const ultimaDecisao = processo.decisoes[0]
        if (!['DEFERIDO', 'PARCIAL'].includes(ultimaDecisao.tipoDecisao)) {
          processosNaoElegiveis.push({
            processoNumero: acordoData.processoNumero,
            contribuinte: processo.contribuinte?.nome,
            statusAtual: processo.status,
            tipoDecisao: ultimaDecisao.tipoDecisao,
            motivo: `Decisão não favorável: ${ultimaDecisao.tipoDecisao}`
          })
          throw new Error(`Decisão não favorável: ${ultimaDecisao.tipoDecisao}`)
        }

        // Verificar se já tem acordo ativo
        const acordoAtivo = processo.acordos.find(acordo => acordo.status === 'ativo')
        if (acordoAtivo) {
          acordosJaExistentes.push({
            processoNumero: acordoData.processoNumero,
            contribuinte: processo.contribuinte?.nome,
            acordoExistente: acordoAtivo.numeroTermo,
            statusAcordo: acordoAtivo.status
          })
          console.log(`⚠️  Processo já possui acordo ativo (${acordoAtivo.numeroTermo}), pulando...`)
          continue
        }

        // Converter datas
        const dataAssinatura = new Date(acordoData.dataAssinatura)
        const dataVencimento = new Date(acordoData.dataVencimento)
        dataAssinatura.setHours(12, 0, 0, 0)
        dataVencimento.setHours(12, 0, 0, 0)

        // Validar datas (removida validação para permitir migração de acordos históricos)

        // Gerar número do termo
        const numeroTermo = await gerarNumeroTermo()

        // Determinar status do processo baseado no status do acordo
        let novoStatusProcesso = 'EM_CUMPRIMENTO' // padrão
        if (acordoData.status === 'cumprido') {
          novoStatusProcesso = 'CONCLUIDO'
        } else if (acordoData.status === 'ativo') {
          novoStatusProcesso = 'EM_CUMPRIMENTO'
        }

        // Calcular valores baseado no tipo de processo
        let valorOriginal = 0
        let valorDesconto = 0
        let percentualDesconto = 0
        let valorFinal = 0

        if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
          // Para transação: valorFinal = valorTotalAcordo
          valorFinal = parseValue(acordoData.valorTotalAcordo)
          valorOriginal = parseValue(acordoData.valorTotalAcordo) // Ou pode usar dados específicos se disponível
          valorDesconto = 0 // Transações normalmente não têm desconto direto
          percentualDesconto = 0
        } else {
          // Para compensação e dação: usar valorTotal e valorFinal do JSON
          valorOriginal = parseValue(acordoData.valorTotal)
          valorFinal = parseValue(acordoData.valorFinal)
          valorDesconto = parseValue(acordoData.valorDesconto) || (valorOriginal - valorFinal)
          percentualDesconto = parseValue(acordoData.percentualDesconto) || (valorOriginal > 0 ? (valorDesconto / valorOriginal) * 100 : 0)
        }

        // Criar acordo usando transaction para garantir consistência (seguindo API atual)
        const acordo = await prisma.$transaction(async (tx) => {
          // Criar acordo base (seguindo estrutura da API atual)
          const acordoBase = await tx.acordo.create({
            data: {
              processoId: processo.id,
              numeroTermo,
              tipoProcesso: processo.tipo,
              dataAssinatura: dataAssinatura,
              dataVencimento: dataVencimento,
              observacoes: acordoData.observacoes || data.configuracao?.observacaoGeral || 'Acordo migrado do sistema anterior',
              status: acordoData.status || 'ativo',
              createdAt: dataAssinatura
            }
          })

          // Criar dados específicos por tipo de processo (seguindo API atual)
          if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
            await tx.acordoTransacao.create({
              data: {
                acordoId: acordoBase.id,
                valorTotalProposto: valorFinal,
                metodoPagamento: acordoData.modalidadePagamento || acordoData.metodoPagamento || 'avista',
                valorEntrada: parseValue(acordoData.valorEntrada) || 0,
                quantidadeParcelas: parseValue(acordoData.numeroParcelas) || 1,
                valorParcela: parseValue(acordoData.numeroParcelas) > 1
                  ? (valorFinal - (parseValue(acordoData.valorEntrada) || 0)) / parseValue(acordoData.numeroParcelas)
                  : null,
                custasAdvocaticias: parseValue(acordoData.custas) || null,
                custasDataVencimento: parseValue(acordoData.custas) > 0 ? dataVencimento : null,
                honorariosValor: parseValue(acordoData.honorarios) || null,
                honorariosMetodoPagamento: parseValue(acordoData.honorarios) > 0 ? 'avista' : null,
                honorariosParcelas: null,
                honorariosValorParcela: null
              }
            })

            // Criar inscrições do acordo (origem do acordo) - usar dados do JSON
            if (acordoData.dadosEspecificos?.inscricoes && Array.isArray(acordoData.dadosEspecificos.inscricoes)) {
              for (const inscricao of acordoData.dadosEspecificos.inscricoes) {
                const valorTotalDebitos = inscricao.debitos?.reduce(
                  (total, debito) => total + (parseValue(debito.valor) || 0), 0
                ) || 0

                const acordoInscricao = await tx.acordoInscricao.create({
                  data: {
                    acordoId: acordoBase.id,
                    numeroInscricao: inscricao.numeroInscricao || 'SEM_NUMERO',
                    tipoInscricao: (inscricao.tipoInscricao || 'imobiliaria').toUpperCase().replace('Á', 'A'),
                    finalidade: 'INCLUIDA_ACORDO',
                    valorTotal: valorTotalDebitos,
                    descricao: `Inscrição ${inscricao.numeroInscricao || 'sem número'} (Migração)`,
                    dataVencimento: null
                  }
                })

                // Criar débitos da inscrição
                if (inscricao.debitos && Array.isArray(inscricao.debitos)) {
                  for (const debito of inscricao.debitos) {
                    let dataVencimentoDebito = dataVencimento // Usar data de vencimento do acordo como padrão
                    if (debito.dataVencimento) {
                      // Tentar converter data no formato DD/MM/YYYY
                      const partesData = debito.dataVencimento.split('/')
                      if (partesData.length === 3) {
                        const [dia, mes, ano] = partesData
                        dataVencimentoDebito = new Date(`${ano}-${mes}-${dia}T12:00:00`)
                      }
                    }

                    await tx.acordoDebito.create({
                      data: {
                        inscricaoId: acordoInscricao.id,
                        descricao: debito.descricao || 'Débito',
                        valorLancado: parseValue(debito.valor) || 0,
                        dataVencimento: dataVencimentoDebito
                      }
                    })
                  }
                }
              }
            }

            // Criar parcelas para transação
            await criarParcelasTransacaoMigracao(tx, acordoBase.id, {
              valorTotalProposto: valorFinal,
              metodoPagamento: acordoData.modalidadePagamento || acordoData.metodoPagamento || 'avista',
              valorEntrada: parseValue(acordoData.valorEntrada) || 0,
              quantidadeParcelas: parseValue(acordoData.numeroParcelas) || 1,
              honorariosValor: parseValue(acordoData.honorarios) || 0
            }, dataVencimento)

          } else if (processo.tipo === 'COMPENSACAO') {
            const valorCreditos = parseValue(acordoData.dadosEspecificos?.valorCreditos) || valorOriginal
            const valorDebitos = parseValue(acordoData.dadosEspecificos?.valorDebitos) || valorFinal

            await tx.acordoCompensacao.create({
              data: {
                acordoId: acordoBase.id,
                valorTotalCreditos: valorCreditos,
                valorTotalDebitos: valorDebitos,
                valorLiquido: valorCreditos - valorDebitos,
                custasAdvocaticias: null,
                custasDataVencimento: null,
                honorariosValor: null,
                honorariosMetodoPagamento: null,
                honorariosParcelas: null,
                honorariosDataVencimento: null
              }
            })

            // Criar créditos do acordo (origem - créditos oferecidos) - usar dados do JSON
            if (acordoData.dadosEspecificos?.creditos && Array.isArray(acordoData.dadosEspecificos.creditos)) {
              for (const credito of acordoData.dadosEspecificos.creditos) {
                let dataVencimentoCredito = null
                if (credito.dataVencimento) {
                  const partesData = credito.dataVencimento.split('/')
                  if (partesData.length === 3) {
                    const [dia, mes, ano] = partesData
                    dataVencimentoCredito = new Date(`${ano}-${mes}-${dia}T12:00:00`)
                  }
                }

                await tx.acordoCredito.create({
                  data: {
                    acordoId: acordoBase.id,
                    tipoCredito: (credito.tipo || 'PRECATORIO').toUpperCase(),
                    numeroCredito: credito.numero || 'SEM_NUMERO',
                    valor: parseValue(credito.valor) || 0,
                    descricao: credito.descricao || credito.tipo || 'Crédito (Migração)',
                    dataVencimento: dataVencimentoCredito
                  }
                })
              }
            }

            // Criar inscrições a compensar (origem - débitos) - usar dados do JSON
            if (acordoData.dadosEspecificos?.inscricoes && Array.isArray(acordoData.dadosEspecificos.inscricoes)) {
              for (const inscricao of acordoData.dadosEspecificos.inscricoes) {
                const valorTotalDebitos = inscricao.debitos?.reduce(
                  (total, debito) => total + (parseValue(debito.valor) || 0), 0
                ) || 0

                const acordoInscricao = await tx.acordoInscricao.create({
                  data: {
                    acordoId: acordoBase.id,
                    numeroInscricao: inscricao.numeroInscricao || 'SEM_NUMERO',
                    tipoInscricao: (inscricao.tipoInscricao || 'imobiliaria').toUpperCase().replace('Á', 'A'),
                    finalidade: 'OFERECIDA_COMPENSACAO',
                    valorTotal: valorTotalDebitos,
                    descricao: `Inscrição ${inscricao.numeroInscricao || 'sem número'} (Migração)`,
                    dataVencimento: null
                  }
                })

                // Criar débitos da inscrição
                if (inscricao.debitos && Array.isArray(inscricao.debitos)) {
                  for (const debito of inscricao.debitos) {
                    let dataVencimentoDebito = dataVencimento // Usar data de vencimento do acordo como padrão
                    if (debito.dataVencimento) {
                      const partesData = debito.dataVencimento.split('/')
                      if (partesData.length === 3) {
                        const [dia, mes, ano] = partesData
                        dataVencimentoDebito = new Date(`${ano}-${mes}-${dia}T12:00:00`)
                      }
                    }

                    await tx.acordoDebito.create({
                      data: {
                        inscricaoId: acordoInscricao.id,
                        descricao: debito.descricao || 'Débito',
                        valorLancado: parseValue(debito.valor) || 0,
                        dataVencimento: dataVencimentoDebito
                      }
                    })
                  }
                }
              }
            }

          } else if (processo.tipo === 'DACAO_PAGAMENTO') {
            const valorOferecido = parseValue(acordoData.dadosEspecificos?.valorOferecido) || valorOriginal
            const valorCompensar = parseValue(acordoData.dadosEspecificos?.valorCompensar) || valorFinal

            await tx.acordoDacao.create({
              data: {
                acordoId: acordoBase.id,
                valorTotalOferecido: valorOferecido,
                valorTotalCompensar: valorCompensar,
                valorLiquido: valorOferecido - valorCompensar,
                custasAdvocaticias: null,
                custasDataVencimento: null,
                honorariosValor: null,
                honorariosMetodoPagamento: null,
                honorariosParcelas: null,
                honorariosDataVencimento: null
              }
            })

            // Criar créditos do acordo como DACAO_IMOVEL (origem - inscrições oferecidas) - usar dados do JSON
            if (acordoData.dadosEspecificos?.inscricoesOferecidas && Array.isArray(acordoData.dadosEspecificos.inscricoesOferecidas)) {
              for (const inscricaoOferecida of acordoData.dadosEspecificos.inscricoesOferecidas) {
                let dataVencimentoCredito = null
                if (inscricaoOferecida.dataVencimento) {
                  const partesData = inscricaoOferecida.dataVencimento.split('/')
                  if (partesData.length === 3) {
                    const [dia, mes, ano] = partesData
                    dataVencimentoCredito = new Date(`${ano}-${mes}-${dia}T12:00:00`)
                  }
                }

                await tx.acordoCredito.create({
                  data: {
                    acordoId: acordoBase.id,
                    tipoCredito: 'DACAO_IMOVEL',
                    numeroCredito: inscricaoOferecida.numeroInscricao || inscricaoOferecida.numero || 'SEM_NUMERO',
                    valor: parseValue(inscricaoOferecida.valor) || 0,
                    descricao: inscricaoOferecida.descricao || `Dação ${inscricaoOferecida.numeroInscricao || ''} (Migração)`,
                    dataVencimento: dataVencimentoCredito
                  }
                })
              }
            }

            // Criar inscrições a compensar (origem - débitos) - usar dados do JSON
            const inscricoesCompensarDacao = acordoData.dadosEspecificos?.inscricoesCompensar || acordoData.dadosEspecificos?.inscricoes
            if (inscricoesCompensarDacao && Array.isArray(inscricoesCompensarDacao)) {
              for (const inscricao of inscricoesCompensarDacao) {
                const valorTotalDebitos = inscricao.debitos?.reduce(
                  (total, debito) => total + (parseValue(debito.valor) || 0), 0
                ) || 0

                const acordoInscricao = await tx.acordoInscricao.create({
                  data: {
                    acordoId: acordoBase.id,
                    numeroInscricao: inscricao.numeroInscricao || 'SEM_NUMERO',
                    tipoInscricao: (inscricao.tipoInscricao || 'imobiliaria').toUpperCase().replace('Á', 'A'),
                    finalidade: 'OFERECIDA_DACAO',
                    valorTotal: valorTotalDebitos,
                    descricao: `Inscrição ${inscricao.numeroInscricao || 'sem número'} (Migração)`,
                    dataVencimento: null
                  }
                })

                // Criar débitos da inscrição
                if (inscricao.debitos && Array.isArray(inscricao.debitos)) {
                  for (const debito of inscricao.debitos) {
                    let dataVencimentoDebito = dataVencimento // Usar data de vencimento do acordo como padrão
                    if (debito.dataVencimento) {
                      const partesData = debito.dataVencimento.split('/')
                      if (partesData.length === 3) {
                        const [dia, mes, ano] = partesData
                        dataVencimentoDebito = new Date(`${ano}-${mes}-${dia}T12:00:00`)
                      }
                    }

                    await tx.acordoDebito.create({
                      data: {
                        inscricaoId: acordoInscricao.id,
                        descricao: debito.descricao || 'Débito',
                        valorLancado: parseValue(debito.valor) || 0,
                        dataVencimento: dataVencimentoDebito
                      }
                    })
                  }
                }
              }
            }
          }

          // Atualizar status do processo
          await tx.processo.update({
            where: { id: processo.id },
            data: { status: novoStatusProcesso }
          })

          // Criar histórico do processo
          let tituloHistorico = 'Acordo de Transação Excepcional Criado (Migração)'
          if (processo.tipo === 'COMPENSACAO') {
            tituloHistorico = 'Acordo de Compensação Criado (Migração)'
          } else if (processo.tipo === 'DACAO_PAGAMENTO') {
            tituloHistorico = 'Acordo de Dação em Pagamento Criado (Migração)'
          }

          // Ajustar título baseado no status do acordo
          if (acordoData.status === 'cumprido') {
            tituloHistorico = tituloHistorico.replace('Criado', 'Cumprido')
          }

          let descricaoAdicional = ''
          if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
            const modalidade = acordoData.modalidadePagamento || acordoData.metodoPagamento || 'avista'
            const parcelas = parseValue(acordoData.numeroParcelas) || 1
            descricaoAdicional = modalidade === 'avista' ? ' - Pagamento à vista' : ` - Parcelamento em ${parcelas}x`
          }

          // Adicionar status do acordo na descrição
          const statusDescricao = acordoData.status === 'cumprido' ? ' - Status: Cumprido' : ' - Status: Ativo'
          descricaoAdicional += statusDescricao

          await tx.historicoProcesso.create({
            data: {
              processoId: processo.id,
              usuarioId: usuarioSistema.id,
              titulo: tituloHistorico,
              descricao: `Termo ${numeroTermo}${descricaoAdicional} - Valor: R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - Migrado do sistema anterior`,
              tipo: 'ACORDO',
              createdAt: dataAssinatura
            }
          })

          // Log de auditoria
          await tx.logAuditoria.create({
            data: {
              usuarioId: usuarioSistema.id,
              acao: 'MIGRATE',
              entidade: 'Acordo',
              entidadeId: acordoBase.id,
              dadosNovos: {
                processoNumero: processo.numero,
                contribuinte: processo.contribuinte.nome,
                valorFinal: valorFinal,
                modalidadePagamento: acordoData.modalidadePagamento || acordoData.metodoPagamento || 'avista',
                numeroParcelas: parseValue(acordoData.numeroParcelas) || 1,
                dataAssinatura: acordoBase.dataAssinatura,
                dataVencimento: acordoBase.dataVencimento,
                statusAcordo: acordoData.status,
                statusProcessoAnterior: processo.status,
                novoStatusProcesso: novoStatusProcesso,
                migracao: true
              },
              createdAt: dataAssinatura
            }
          })

          return acordoBase
        })

        console.log(`✅ Acordo criado: ${acordo.numeroTermo} (ID: ${acordo.id})`)
        console.log(`✅ Status do processo atualizado: ${processo.status} → ${novoStatusProcesso}`)
        console.log(`📋 Status do acordo: ${acordoData.status}`)

        console.log(`✅ Acordo migrado com sucesso: ${acordo.numeroTermo}`)
        acordosCriados++

      } catch (error) {
        erros++
        const erroInfo = {
          processoNumero: acordoData.processoNumero,
          erro: error.message,
          dados: {
            dataAssinatura: acordoData.dataAssinatura,
            valorFinal: acordoData.valorFinal
          }
        }
        errosDetalhados.push(erroInfo)

        console.error(`❌ Erro ao processar acordo para processo ${acordoData.processoNumero}:`, error.message)
      }
    }

    // Relatório final
    console.log('\n' + '='.repeat(60))
    console.log('📊 RELATÓRIO FINAL DE MIGRAÇÃO DE ACORDOS')
    console.log('='.repeat(60))
    console.log(`📋 Total de acordos para migração: ${data.acordos.length}`)
    console.log(`✅ Acordos migrados com sucesso: ${acordosCriados}`)
    console.log(`⚠️  Acordos já existentes (pulados): ${acordosJaExistentes.length}`)
    console.log(`❌ Erros durante a migração: ${erros}`)
    console.log(`📈 Taxa de sucesso: ${data.acordos.length > 0 ? ((acordosCriados / data.acordos.length) * 100).toFixed(1) : 0}%`)

    // Processos não encontrados
    if (processosNaoEncontrados.length > 0) {
      console.log('\n🔍 ===== PROCESSOS NÃO ENCONTRADOS =====')
      console.log(`Total: ${processosNaoEncontrados.length} processos`)
      console.log('=========================================')
      processosNaoEncontrados.forEach((processo, index) => {
        console.log(`\n${index + 1}. Processo: ${processo.processoNumero}`)
        console.log(`   Valor Final: R$ ${Number(processo.valorFinal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      })
      console.log('\n💡 Ações recomendadas:')
      console.log('- Verifique se os números dos processos estão corretos')
      console.log('- Confirme se estes processos foram migrados corretamente nas etapas anteriores')
      console.log('- Execute as migrações de processos antes de tentar criar acordos')
    }

    // Processos não elegíveis
    if (processosNaoElegiveis.length > 0) {
      console.log('\n⚖️  ===== PROCESSOS NÃO ELEGÍVEIS PARA ACORDO =====')
      console.log(`Total: ${processosNaoElegiveis.length} processos`)
      console.log('=================================================')
      processosNaoElegiveis.forEach((processo, index) => {
        console.log(`\n${index + 1}. Processo: ${processo.processoNumero}`)
        console.log(`   Contribuinte: ${processo.contribuinte}`)
        console.log(`   Status Atual: ${processo.statusAtual}`)
        if (processo.tipoDecisao) {
          console.log(`   Tipo Decisão: ${processo.tipoDecisao}`)
        }
        console.log(`   Motivo: ${processo.motivo}`)
      })
      console.log('\n💡 Ações recomendadas:')
      console.log('- Para processos não julgados: aguardar julgamento')
      console.log('- Para processos indeferidos: não é possível criar acordos')
      console.log('- Para processos sem decisão: verificar se as decisões foram migradas corretamente')
    }

    // Acordos já existentes
    if (acordosJaExistentes.length > 0) {
      console.log('\n📋 ===== PROCESSOS COM ACORDOS EXISTENTES =====')
      console.log(`Total: ${acordosJaExistentes.length} processos`)
      console.log('=============================================')
      acordosJaExistentes.forEach((acordo, index) => {
        console.log(`\n${index + 1}. Processo: ${acordo.processoNumero}`)
        console.log(`   Contribuinte: ${acordo.contribuinte}`)
        console.log(`   Acordo Existente: ${acordo.acordoExistente}`)
        console.log(`   Status do Acordo: ${acordo.statusAcordo}`)
      })
      console.log('\n💡 Ações recomendadas:')
      console.log('- Verifique se os acordos existentes são corretos')
      console.log('- Se necessário, cancele o acordo existente antes de criar um novo')
      console.log('- Confirme se não há duplicidade nos dados de migração')
    }

    // Outros erros detalhados
    if (errosDetalhados.length > 0) {
      console.log('\n🚨 ===== OUTROS ERROS DURANTE A MIGRAÇÃO =====')
      console.log(`Total: ${errosDetalhados.length} erros`)
      console.log('============================================')
      errosDetalhados.forEach((erro, index) => {
        console.log(`\n${index + 1}. Processo: ${erro.processoNumero}`)
        console.log(`   Erro: ${erro.erro}`)
        console.log(`   Dados: ${JSON.stringify(erro.dados, null, 2)}`)
      })
    }

    // Resumo final
    console.log('\n🏆 ===== RESUMO FINAL =====')
    console.log('==========================')
    console.log(`📊 Total processado: ${data.acordos.length}`)
    console.log(`✅ Sucessos: ${acordosCriados}`)
    console.log(`⚠️  Pulados (já existem): ${acordosJaExistentes.length}`)
    console.log(`🔍 Processos não encontrados: ${processosNaoEncontrados.length}`)
    console.log(`⚖️  Processos não elegíveis: ${processosNaoElegiveis.length}`)
    console.log(`🚨 Outros erros: ${errosDetalhados.length}`)

    if (erros === 0) {
      console.log('\n🎉 Migração de acordos concluída com sucesso!')
    } else {
      console.log('\n⚠️  Migração concluída com alguns problemas. Verifique os detalhes acima.')
    }

  } catch (error) {
    console.error('💥 Erro fatal durante a migração:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar migração
if (require.main === module) {
  migrarAcordos()
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
  migrarAcordos
}