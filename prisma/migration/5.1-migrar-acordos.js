// node prisma/migration/5.1-migrar-acordos.js

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

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

// Função para criar detalhes específicos do acordo
async function criarDetalhesEspecificos(acordoId, tipoProcesso, dadosEspecificos) {
  switch (tipoProcesso) {
    case 'TRANSACAO_EXCEPCIONAL':
      const inscricoesData = dadosEspecificos.inscricoes || []
      if (inscricoesData.length > 0) {
        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'transacao',
            descricao: 'Transação Excepcional - Acordo Migrado',
            valorOriginal: dadosEspecificos.valorInscricoes || 0,
            valorNegociado: dadosEspecificos.valorInscricoes || 0,
            status: 'PENDENTE',
            observacoes: 'Migrado do sistema anterior'
          }
        })

        // Criar registros das inscrições
        for (const inscricao of inscricoesData) {
          const valorDebitos = inscricao.debitos?.reduce(
            (total, debito) => total + (Number(debito?.valor) || 0), 0
          ) || 0

          const debitosDetalhados = inscricao.debitos?.map((debito) => ({
            descricao: debito.descricao,
            valor: Number(debito.valor),
            dataVencimento: debito.dataVencimento
          })) || []

          await prisma.acordoInscricao.create({
            data: {
              acordoDetalheId: detalhe.id,
              numeroInscricao: inscricao.numeroInscricao,
              tipoInscricao: inscricao.tipoInscricao,
              valorDebito: valorDebitos,
              valorAbatido: valorDebitos,
              percentualAbatido: 100,
              situacao: 'pendente',
              descricaoDebitos: JSON.stringify(debitosDetalhados)
            }
          })
        }
      }
      break

    case 'COMPENSACAO':
      const creditos = dadosEspecificos.creditos || []
      const inscricoes = dadosEspecificos.inscricoes || []

      if (creditos.length > 0 || inscricoes.length > 0) {
        const creditosData = creditos.length > 0 ? {
          creditosOferecidos: creditos,
          valorTotalCreditos: dadosEspecificos.valorCreditos || 0
        } : null

        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'compensacao',
            descricao: 'Compensação de Créditos e Débitos - Migrado',
            valorOriginal: Math.max(dadosEspecificos.valorCreditos || 0, dadosEspecificos.valorDebitos || 0),
            valorNegociado: Math.max(dadosEspecificos.valorCreditos || 0, dadosEspecificos.valorDebitos || 0),
            status: 'PENDENTE',
            observacoes: creditosData ? JSON.stringify(creditosData) : 'Migrado do sistema anterior'
          }
        })

        // Criar registros para inscrições a compensar
        for (const inscricao of inscricoes) {
          const valorDebitos = inscricao.debitos?.reduce(
            (total, debito) => total + (Number(debito?.valor) || 0), 0
          ) || 0

          const debitosDetalhados = inscricao.debitos?.map((debito) => ({
            descricao: debito.descricao,
            valor: Number(debito.valor),
            dataVencimento: debito.dataVencimento
          })) || []

          await prisma.acordoInscricao.create({
            data: {
              acordoDetalheId: detalhe.id,
              numeroInscricao: inscricao.numeroInscricao,
              tipoInscricao: inscricao.tipoInscricao,
              valorDebito: valorDebitos,
              valorAbatido: valorDebitos,
              percentualAbatido: 100,
              situacao: 'pendente',
              descricaoDebitos: JSON.stringify(debitosDetalhados)
            }
          })
        }
      }
      break

    case 'DACAO_PAGAMENTO':
      const inscricoesOferecidas = dadosEspecificos.inscricoesOferecidas || []
      const inscricoesCompensar = dadosEspecificos.inscricoesCompensar || []

      if (inscricoesOferecidas.length > 0 || inscricoesCompensar.length > 0) {
        const dadosTecnicos = {
          inscricoesOferecidas: inscricoesOferecidas,
          valorTotalOferecido: dadosEspecificos.valorOferecido || 0,
          valorCompensar: dadosEspecificos.valorCompensar || 0,
          saldoFinal: (dadosEspecificos.valorOferecido || 0) - (dadosEspecificos.valorCompensar || 0)
        }

        const detalhe = await prisma.acordoDetalhes.create({
          data: {
            acordoId,
            tipo: 'dacao',
            descricao: 'Dação em Pagamento - Migrado',
            valorOriginal: dadosEspecificos.valorOferecido || 0,
            valorNegociado: dadosEspecificos.valorOferecido || 0,
            observacoes: JSON.stringify(dadosTecnicos),
            status: 'PENDENTE'
          }
        })

        // Criar registros para inscrições a compensar
        for (const inscricao of inscricoesCompensar) {
          const valorDebitos = inscricao.debitos?.reduce(
            (total, debito) => total + (Number(debito?.valor) || 0), 0
          ) || 0

          const debitosDetalhados = inscricao.debitos?.map((debito) => ({
            descricao: debito.descricao,
            valor: Number(debito.valor),
            dataVencimento: debito.dataVencimento
          })) || []

          await prisma.acordoInscricao.create({
            data: {
              acordoDetalheId: detalhe.id,
              numeroInscricao: inscricao.numeroInscricao,
              tipoInscricao: inscricao.tipoInscricao,
              valorDebito: valorDebitos,
              valorAbatido: valorDebitos,
              percentualAbatido: 100,
              situacao: 'pendente',
              descricaoDebitos: JSON.stringify(debitosDetalhados)
            }
          })
        }
      }
      break
  }
}

// Função para criar parcelas (apenas para TRANSACAO_EXCEPCIONAL)
async function criarParcelas(acordo, dadosEspecificos) {
  const { modalidadePagamento, numeroParcelas, valorFinal, valorEntrada, dataAssinatura, dataVencimento } = acordo

  if (modalidadePagamento === 'parcelado' && numeroParcelas && numeroParcelas > 1) {
    const valorParaParcelas = valorFinal - (valorEntrada || 0)
    const valorParcela = valorParaParcelas / numeroParcelas
    const parcelas = []

    // Se há entrada, criar parcela 0
    if (valorEntrada && valorEntrada > 0) {
      const dataVencimentoEntrada = new Date(dataAssinatura)
      dataVencimentoEntrada.setHours(12, 0, 0, 0)

      parcelas.push({
        acordoId: acordo.id,
        numero: 0,
        valor: valorEntrada,
        dataVencimento: dataVencimentoEntrada,
        status: 'PENDENTE'
      })
    }

    // Criar parcelas normais
    for (let i = 1; i <= numeroParcelas; i++) {
      const dataVencimentoParcela = new Date(dataVencimento)
      dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i - 1))
      dataVencimentoParcela.setHours(12, 0, 0, 0)

      parcelas.push({
        acordoId: acordo.id,
        numero: i,
        valor: i === numeroParcelas
          ? valorParaParcelas - (valorParcela * (numeroParcelas - 1)) // Ajustar última parcela
          : valorParcela,
        dataVencimento: dataVencimentoParcela,
        status: 'PENDENTE'
      })
    }

    await prisma.parcela.createMany({
      data: parcelas
    })
  } else {
    // Pagamento à vista
    const dataVencimentoAvista = new Date(dataVencimento)
    dataVencimentoAvista.setHours(12, 0, 0, 0)

    await prisma.parcela.create({
      data: {
        acordoId: acordo.id,
        numero: 1,
        valor: valorFinal,
        dataVencimento: dataVencimentoAvista,
        status: 'PENDENTE'
      }
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

        // Validar datas
        if (dataVencimento <= dataAssinatura) {
          throw new Error('Data de vencimento deve ser posterior à data de assinatura')
        }

        // Gerar número do termo
        const numeroTermo = await gerarNumeroTermo()

        // Calcular valores
        let valorOriginal = acordoData.valorTotal || 0
        let valorDesconto = acordoData.valorDesconto || 0
        let percentualDesconto = acordoData.percentualDesconto || 0

        // Ajustar valores baseado no tipo de processo
        if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && acordoData.dadosEspecificos?.valorInscricoes) {
          valorOriginal = acordoData.dadosEspecificos.valorInscricoes
          valorDesconto = valorOriginal - acordoData.valorFinal
          percentualDesconto = valorOriginal > 0 ? (valorDesconto / valorOriginal) * 100 : 0
        } else if (processo.tipo === 'COMPENSACAO' && acordoData.dadosEspecificos?.valorCreditos) {
          valorOriginal = acordoData.dadosEspecificos.valorCreditos
        } else if (processo.tipo === 'DACAO_PAGAMENTO' && acordoData.dadosEspecificos?.valorOferecido) {
          valorOriginal = acordoData.dadosEspecificos.valorOferecido
        }

        // Criar acordo
        const acordo = await prisma.acordo.create({
          data: {
            processoId: processo.id,
            numeroTermo,
            valorTotal: valorOriginal,
            valorDesconto: valorDesconto,
            percentualDesconto: percentualDesconto,
            valorFinal: acordoData.valorFinal,
            valorEntrada: acordoData.valorEntrada || null,
            dataAssinatura: dataAssinatura,
            dataVencimento: dataVencimento,
            modalidadePagamento: acordoData.modalidadePagamento || 'avista',
            numeroParcelas: acordoData.numeroParcelas || 1,
            observacoes: acordoData.observacoes || data.configuracao?.observacaoGeral || 'Acordo migrado do sistema anterior',
            clausulasEspeciais: acordoData.clausulasEspeciais || null,
            status: acordoData.status || 'ativo'
          }
        })

        console.log(`✅ Acordo criado: ${acordo.numeroTermo} (ID: ${acordo.id})`)

        // Criar detalhes específicos
        if (acordoData.dadosEspecificos) {
          await criarDetalhesEspecificos(acordo.id, processo.tipo, acordoData.dadosEspecificos)
          console.log(`✅ Detalhes específicos criados para tipo: ${processo.tipo}`)
        }

        // Criar parcelas (apenas para TRANSACAO_EXCEPCIONAL)
        if (processo.tipo === 'TRANSACAO_EXCEPCIONAL') {
          await criarParcelas(acordo, acordoData.dadosEspecificos)
          console.log(`✅ Parcelas criadas: ${acordoData.numeroParcelas || 1}`)
        }

        // Atualizar status do processo baseado no status do acordo
        let novoStatusProcesso = 'EM_CUMPRIMENTO' // padrão
        if (acordoData.status === 'cumprido') {
          novoStatusProcesso = 'CONCLUIDO'
        } else if (acordoData.status === 'ativo') {
          novoStatusProcesso = 'EM_CUMPRIMENTO'
        }

        await prisma.processo.update({
          where: { id: processo.id },
          data: { status: novoStatusProcesso }
        })

        console.log(`✅ Status do processo atualizado: ${processo.status} → ${novoStatusProcesso}`)
        console.log(`📋 Status do acordo: ${acordoData.status}`)

        // Criar histórico do processo
        let tituloHistorico = 'Acordo de Pagamento Criado (Migração)'
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
          descricaoAdicional = acordo.modalidadePagamento === 'avista' ? ' - Pagamento à vista' : ` - Parcelamento em ${acordo.numeroParcelas}x`
        }

        // Adicionar status do acordo na descrição
        const statusDescricao = acordoData.status === 'cumprido' ? ' - Status: Cumprido' : ' - Status: Ativo'
        descricaoAdicional += statusDescricao

        await prisma.historicoProcesso.create({
          data: {
            processoId: processo.id,
            usuarioId: usuarioSistema.id,
            titulo: tituloHistorico,
            descricao: `Termo ${numeroTermo}${descricaoAdicional} - Valor: R$ ${acordo.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - Migrado do sistema anterior`,
            tipo: 'ACORDO'
          }
        })

        // Log de auditoria
        await prisma.logAuditoria.create({
          data: {
            usuarioId: usuarioSistema.id,
            acao: 'CREATE',
            entidade: 'Acordo',
            entidadeId: acordo.id,
            dadosNovos: {
              processoNumero: processo.numero,
              contribuinte: processo.contribuinte.nome,
              valorTotal: acordo.valorTotal,
              valorFinal: acordo.valorFinal,
              modalidadePagamento: acordo.modalidadePagamento,
              numeroParcelas: acordo.numeroParcelas,
              dataAssinatura: acordo.dataAssinatura,
              dataVencimento: acordo.dataVencimento,
              statusAcordo: acordoData.status,
              statusProcessoAnterior: processo.status,
              novoStatusProcesso: novoStatusProcesso,
              migracao: true
            }
          }
        })

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