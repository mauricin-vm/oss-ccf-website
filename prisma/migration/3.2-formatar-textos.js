// node prisma/migration/3.2-formatar-textos.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Converte texto em maiúsculo para formato título, preservando siglas e acrônimos
 * @param {string} texto - Texto a ser formatado
 * @returns {string} - Texto formatado
 */
function formatarTextoTitulo(texto) {
  if (!texto || typeof texto !== 'string') return texto;

  // Lista de palavras que devem permanecer em minúsculo (conectores)
  const conectores = [
    'a', 'as', 'o', 'os', 'da', 'das', 'do', 'dos', 'de', 'em', 'na', 'nas', 'no', 'nos',
    'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre', 'contra', 'ante', 'até'
  ];

  // Lista de siglas que devem permanecer em maiúsculo
  const siglas = [
    'LTDA', 'ME', 'EPP', 'SA', 'SS', 'CIA', 'EIRELI', 'SLU', 'CNPJ', 'CPF',
    'CARF', 'TCE', 'TJ', 'STJ', 'STF', 'OAB', 'CRC', 'CRA', 'CRECI'
  ];

  return texto
    .toLowerCase()
    .split(' ')
    .map((palavra, index) => {
      if (!palavra) return palavra;

      // Preserva siglas em maiúsculo
      if (siglas.includes(palavra.toUpperCase())) {
        return palavra.toUpperCase();
      }

      // Primeira palavra sempre com inicial maiúscula
      if (index === 0) {
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
      }

      // Conectores em minúsculo (exceto se for a primeira palavra)
      if (conectores.includes(palavra.toLowerCase())) {
        return palavra.toLowerCase();
      }

      // Demais palavras com inicial maiúscula
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}

/**
 * Formata nomes de contribuintes
 */
async function formatarNomesContribuintes() {
  console.log('🔄 Iniciando formatação dos nomes de contribuintes...');

  try {
    // Busca todos os contribuintes
    const contribuintes = await prisma.contribuinte.findMany({
      select: {
        id: true,
        nome: true
      }
    });

    console.log(`📊 Encontrados ${contribuintes.length} contribuintes para processar`);

    let processados = 0;
    let atualizados = 0;

    for (const contribuinte of contribuintes) {
      const nomeOriginal = contribuinte.nome;
      const nomeFormatado = formatarTextoTitulo(nomeOriginal);

      processados++;

      // Só atualiza se o nome mudou
      if (nomeOriginal !== nomeFormatado) {
        await prisma.contribuinte.update({
          where: { id: contribuinte.id },
          data: { nome: nomeFormatado }
        });

        atualizados++;
        console.log(`✅ Atualizado: "${nomeOriginal}" → "${nomeFormatado}"`);
      }

      // Log de progresso a cada 50 registros
      if (processados % 50 === 0) {
        console.log(`📈 Progresso: ${processados}/${contribuintes.length} (${atualizados} atualizados)`);
      }
    }

    console.log(`✅ Formatação de nomes concluída: ${atualizados}/${processados} contribuintes atualizados`);

  } catch (error) {
    console.error('❌ Erro ao formatar nomes de contribuintes:', error);
    throw error;
  }
}

/**
 * Formata títulos e descrições dos históricos
 */
async function formatarHistoricos() {
  console.log('🔄 Iniciando formatação dos históricos...');

  try {
    // Busca todos os históricos
    const historicos = await prisma.historicoProcesso.findMany({
      select: {
        id: true,
        titulo: true,
        descricao: true
      }
    });

    console.log(`📊 Encontrados ${historicos.length} históricos para processar`);

    let processados = 0;
    let atualizados = 0;

    for (const historico of historicos) {
      const tituloOriginal = historico.titulo;
      const descricaoOriginal = historico.descricao;

      const tituloFormatado = formatarTextoTitulo(tituloOriginal);
      const descricaoFormatada = formatarTextoTitulo(descricaoOriginal);

      processados++;

      // Só atualiza se algum campo mudou
      if (tituloOriginal !== tituloFormatado || descricaoOriginal !== descricaoFormatada) {
        await prisma.historicoProcesso.update({
          where: { id: historico.id },
          data: {
            titulo: tituloFormatado,
            descricao: descricaoFormatada
          }
        });

        atualizados++;

        if (tituloOriginal !== tituloFormatado) {
          console.log(`✅ Título atualizado: "${tituloOriginal}" → "${tituloFormatado}"`);
        }
        if (descricaoOriginal !== descricaoFormatada) {
          console.log(`✅ Descrição atualizada: "${descricaoOriginal}" → "${descricaoFormatada}"`);
        }
      }

      // Log de progresso a cada 50 registros
      if (processados % 50 === 0) {
        console.log(`📈 Progresso: ${processados}/${historicos.length} (${atualizados} atualizados)`);
      }
    }

    console.log(`✅ Formatação de históricos concluída: ${atualizados}/${processados} históricos atualizados`);

  } catch (error) {
    console.error('❌ Erro ao formatar históricos:', error);
    throw error;
  }
}

/**
 * Função para testar a formatação sem alterar dados
 */
async function testarFormatacao() {
  console.log('🧪 Testando formatação...');

  // Testes para nomes de contribuintes
  const testesNomes = [
    'INSTITUTO VIEIRA DE EDUCACAO LTDA ME',
    'JOÃO DA SILVA SANTOS',
    'EMPRESA XYZ COMERCIO E SERVICOS LTDA',
    'MARIA DAS GRACAS OLIVEIRA'
  ];

  console.log('\n📝 Testes para nomes de contribuintes:');
  testesNomes.forEach(nome => {
    const formatado = formatarTextoTitulo(nome);
    console.log(`"${nome}" → "${formatado}"`);
  });

  // Testes para históricos
  const testesHistoricos = [
    'DISTRIBUÍDO A CONSELHEIRA ISABELA BATISTA MACHADO SOARES SCARAMAL. PAUTA DO DIA: 11.09.2025.',
    'PROCESSO RECEBIDO PARA ANÁLISE TÉCNICA.',
    'ENCAMINHADO PARA O SETOR DE COMPENSAÇÃO.'
  ];

  console.log('\n📝 Testes para históricos:');
  testesHistoricos.forEach(historico => {
    const formatado = formatarTextoTitulo(historico);
    console.log(`"${historico}" → "${formatado}"`);
  });
}

/**
 * Função principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando script de formatação de textos...\n');

    // Primeiro, executa os testes
    await testarFormatacao();

    console.log('\n' + '='.repeat(60));
    console.log('EXECUTANDO FORMATAÇÃO REAL');
    console.log('='.repeat(60) + '\n');

    // Formata nomes de contribuintes
    await formatarNomesContribuintes();

    console.log('\n' + '-'.repeat(40) + '\n');

    // Formata históricos
    await formatarHistoricos();

    console.log('\n🎉 Script executado com sucesso!');

  } catch (error) {
    console.error('❌ Erro na execução do script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executa o script apenas se for chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  formatarTextoTitulo,
  formatarNomesContribuintes,
  formatarHistoricos,
  testarFormatacao
};