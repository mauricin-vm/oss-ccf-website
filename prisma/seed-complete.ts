import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Limpar dados existentes (opcional - comentar se quiser manter dados anteriores)
  await prisma.pagamentoParcela.deleteMany()
  await prisma.parcela.deleteMany()
  await prisma.acordo.deleteMany()
  await prisma.decisao.deleteMany()
  await prisma.sessaoJulgamento.deleteMany()
  await prisma.processoPauta.deleteMany()
  await prisma.pauta.deleteMany()
  await prisma.documento.deleteMany()
  await prisma.tramitacao.deleteMany()
  await prisma.processoCredito.deleteMany()
  await prisma.credito.deleteMany()
  await prisma.processoImovel.deleteMany()
  await prisma.imovel.deleteMany()
  await prisma.processo.deleteMany()
  await prisma.contribuinte.deleteMany()
  await prisma.logAuditoria.deleteMany()
  await prisma.setor.deleteMany()
  await prisma.user.deleteMany()

  console.log('🧹 Banco de dados limpo')

  // Criar usuários
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@ccf.gov.br',
      name: 'Administrador',
      password: hashedPassword,
      role: 'ADMIN',
      active: true
    }
  })

  const funcionario = await prisma.user.create({
    data: {
      email: 'funcionario@ccf.gov.br',
      name: 'Maria Santos',
      password: await bcrypt.hash('func123', 10),
      role: 'FUNCIONARIO',
      active: true
    }
  })

  const conselheiro1 = await prisma.user.create({
    data: {
      email: 'conselheiro1@ccf.gov.br',
      name: 'Dr. Carlos Mendes',
      password: await bcrypt.hash('conselheiro123', 10),
      role: 'FUNCIONARIO',
      active: true
    }
  })

  const conselheiro2 = await prisma.user.create({
    data: {
      email: 'conselheiro2@ccf.gov.br',
      name: 'Dra. Ana Paula',
      password: await bcrypt.hash('conselheiro123', 10),
      role: 'FUNCIONARIO',
      active: true
    }
  })

  const visualizador = await prisma.user.create({
    data: {
      email: 'diretor@ccf.gov.br',
      name: 'Diretor Financeiro',
      password: await bcrypt.hash('diretor123', 10),
      role: 'VISUALIZADOR',
      active: true
    }
  })

  console.log('✅ Usuários criados')

  // Criar setores
  const setores = [
    { nome: 'Câmara de Conciliação Fiscal', sigla: 'CCF' },
    { nome: 'Secretaria de Fazenda', sigla: 'SEFAZ' },
    { nome: 'Procuradoria Geral', sigla: 'PGM' },
    { nome: 'Secretaria de Urbanismo', sigla: 'SMU' },
    { nome: 'Secretaria de Administração', sigla: 'SMA' }
  ]

  for (const setor of setores) {
    await prisma.setor.create({ data: setor })
  }

  console.log('✅ Setores criados')

  // Criar contribuintes
  const contribuinte1 = await prisma.contribuinte.create({
    data: {
      cpfCnpj: '12345678901234',
      nome: 'Empresa ABC Ltda',
      email: 'contato@empresaabc.com',
      telefone: '11987654321',
      endereco: 'Av. Paulista, 1000',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01310100'
    }
  })

  const contribuinte2 = await prisma.contribuinte.create({
    data: {
      cpfCnpj: '98765432109876',
      nome: 'Comércio XYZ EIRELI',
      email: 'financeiro@comercioxyz.com',
      telefone: '11912345678',
      endereco: 'Rua Augusta, 500',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01305000'
    }
  })

  const contribuinte3 = await prisma.contribuinte.create({
    data: {
      cpfCnpj: '11122233344455',
      nome: 'Indústria Beta S.A.',
      email: 'fiscal@industriabeta.com',
      telefone: '11934567890',
      endereco: 'Rua da Consolação, 2000',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01301000'
    }
  })

  const contribuinte4 = await prisma.contribuinte.create({
    data: {
      cpfCnpj: '55544433322211',
      nome: 'Construtora Alfa',
      email: 'administrativo@construtoraalfa.com',
      telefone: '11945678901',
      endereco: 'Av. Faria Lima, 3000',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '04538132'
    }
  })

  console.log('✅ Contribuintes criados')

  // Criar imóveis
  const imovel1 = await prisma.imovel.create({
    data: {
      matricula: 'MAT-001-2024',
      endereco: 'Rua das Flores, 100',
      cidade: 'São Paulo',
      estado: 'SP',
      valorAvaliado: 500000.00,
      descricao: 'Galpão industrial de 1000m²',
      proprietarioId: contribuinte1.id
    }
  })

  const imovel2 = await prisma.imovel.create({
    data: {
      matricula: 'MAT-002-2024',
      endereco: 'Av. Comercial, 200',
      cidade: 'São Paulo',
      estado: 'SP',
      valorAvaliado: 750000.00,
      descricao: 'Loja comercial em centro comercial',
      proprietarioId: contribuinte2.id
    }
  })

  console.log('✅ Imóveis criados')

  // Criar créditos
  const credito1 = await prisma.credito.create({
    data: {
      tipo: 'precatorio',
      numero: 'PREC-2024-001',
      valor: 200000.00,
      dataVencimento: new Date('2025-12-31'),
      descricao: 'Precatório alimentar'
    }
  })

  const credito2 = await prisma.credito.create({
    data: {
      tipo: 'credito_tributario',
      numero: 'CRED-2024-001',
      valor: 150000.00,
      descricao: 'Crédito tributário ICMS'
    }
  })

  console.log('✅ Créditos criados')

  // Criar processos variados
  const processo1 = await prisma.processo.create({
    data: {
      numero: 'CCF-2024-001',
      tipo: 'COMPENSACAO',
      status: 'EM_PAUTA',
      valorOriginal: 250000.00,
      valorNegociado: 200000.00,
      observacoes: 'Processo de compensação de débitos com precatórios',
      contribuinteId: contribuinte1.id,
      createdById: funcionario.id,
      imoveis: {
        create: {
          imovelId: imovel1.id,
          tipoRelacao: 'garantia'
        }
      },
      creditos: {
        create: {
          creditoId: credito1.id,
          valorUtilizado: 200000.00
        }
      }
    }
  })

  const processo2 = await prisma.processo.create({
    data: {
      numero: 'CCF-2024-002',
      tipo: 'DACAO_PAGAMENTO',
      status: 'ACORDO_FIRMADO',
      valorOriginal: 500000.00,
      valorNegociado: 450000.00,
      observacoes: 'Dação em pagamento de imóvel para quitação de débitos',
      contribuinteId: contribuinte2.id,
      createdById: funcionario.id,
      imoveis: {
        create: {
          imovelId: imovel2.id,
          tipoRelacao: 'dacao'
        }
      }
    }
  })

  const processo3 = await prisma.processo.create({
    data: {
      numero: 'CCF-2024-003',
      tipo: 'TRANSACAO_EXCEPCIONAL',
      status: 'EM_CUMPRIMENTO',
      valorOriginal: 1500000.00,
      valorNegociado: 1200000.00,
      observacoes: 'Transação tributária excepcional com parcelamento especial',
      contribuinteId: contribuinte3.id,
      createdById: funcionario.id
    }
  })

  const processo4 = await prisma.processo.create({
    data: {
      numero: 'CCF-2024-004',
      tipo: 'COMPENSACAO',
      status: 'RECEPCIONADO',
      valorOriginal: 100000.00,
      observacoes: 'Novo processo aguardando análise inicial',
      contribuinteId: contribuinte4.id,
      createdById: funcionario.id
    }
  })

  const processo5 = await prisma.processo.create({
    data: {
      numero: 'CCF-2024-005',
      tipo: 'DACAO_PAGAMENTO',
      status: 'FINALIZADO',
      valorOriginal: 300000.00,
      valorNegociado: 280000.00,
      dataFinalizacao: new Date('2024-10-15'),
      observacoes: 'Processo finalizado com sucesso',
      contribuinteId: contribuinte1.id,
      createdById: funcionario.id
    }
  })

  console.log('✅ Processos criados')

  // Criar documentos para alguns processos
  await prisma.documento.createMany({
    data: [
      {
        processoId: processo1.id,
        nome: 'Petição Inicial',
        tipo: 'pdf',
        url: '/uploads/peticao-inicial-001.pdf',
        tamanho: 1024000
      },
      {
        processoId: processo1.id,
        nome: 'Certidão de Débitos',
        tipo: 'pdf',
        url: '/uploads/certidao-debitos-001.pdf',
        tamanho: 512000
      },
      {
        processoId: processo2.id,
        nome: 'Avaliação do Imóvel',
        tipo: 'pdf',
        url: '/uploads/avaliacao-imovel-002.pdf',
        tamanho: 2048000
      },
      {
        processoId: processo3.id,
        nome: 'Proposta de Acordo',
        tipo: 'pdf',
        url: '/uploads/proposta-acordo-003.pdf',
        tamanho: 768000
      }
    ]
  })

  console.log('✅ Documentos criados')

  // Criar tramitações
  await prisma.tramitacao.createMany({
    data: [
      {
        processoId: processo1.id,
        setorOrigem: 'CCF',
        setorDestino: 'SEFAZ',
        dataRecebimento: new Date('2024-01-10'),
        prazoResposta: new Date('2024-01-25'),
        observacoes: 'Enviado para análise fiscal',
        usuarioId: funcionario.id
      },
      {
        processoId: processo1.id,
        setorOrigem: 'SEFAZ',
        setorDestino: 'PGM',
        dataRecebimento: new Date('2024-01-26'),
        prazoResposta: new Date('2024-02-10'),
        observacoes: 'Parecer fiscal favorável, enviado para análise jurídica',
        usuarioId: funcionario.id
      },
      {
        processoId: processo2.id,
        setorOrigem: 'CCF',
        setorDestino: 'SMU',
        dataRecebimento: new Date('2024-02-01'),
        prazoResposta: new Date('2024-02-15'),
        observacoes: 'Verificação de regularidade do imóvel',
        usuarioId: funcionario.id
      }
    ]
  })

  console.log('✅ Tramitações criadas')

  // Criar pautas
  const pauta1 = await prisma.pauta.create({
    data: {
      numero: 'PAUTA-2024-001',
      dataPauta: new Date('2024-11-20T14:00:00'),
      status: 'fechada',
      observacoes: 'Sessão ordinária de novembro'
    }
  })

  const pauta2 = await prisma.pauta.create({
    data: {
      numero: 'PAUTA-2024-002',
      dataPauta: new Date('2024-12-15T14:00:00'),
      status: 'aberta',
      observacoes: 'Sessão ordinária de dezembro'
    }
  })

  console.log('✅ Pautas criadas')

  // Adicionar processos às pautas
  await prisma.processoPauta.createMany({
    data: [
      {
        processoId: processo1.id,
        pautaId: pauta2.id,
        ordem: 1,
        relator: 'Dr. Carlos Mendes'
      },
      {
        processoId: processo2.id,
        pautaId: pauta1.id,
        ordem: 1,
        relator: 'Dra. Ana Paula'
      },
      {
        processoId: processo3.id,
        pautaId: pauta1.id,
        ordem: 2,
        relator: 'Dr. Carlos Mendes'
      }
    ]
  })

  console.log('✅ Processos adicionados às pautas')

  // Criar sessão de julgamento para pauta fechada
  const sessao1 = await prisma.sessaoJulgamento.create({
    data: {
      pautaId: pauta1.id,
      dataInicio: new Date('2024-11-20T14:00:00'),
      dataFim: new Date('2024-11-20T17:30:00'),
      ata: `ATA DA SESSÃO ORDINÁRIA Nº 001/2024
      
Aos vinte dias do mês de novembro de 2024, às 14:00 horas, reuniu-se a Câmara de Conciliação Fiscal.

PROCESSOS JULGADOS:
1. CCF-2024-002 - DEFERIDO - Aprovada a dação em pagamento
2. CCF-2024-003 - DEFERIDO PARCIALMENTE - Aprovado parcelamento em 60 meses

Nada mais havendo a tratar, foi encerrada a sessão às 17:30.`,
      conselheiros: {
        connect: [
          { id: conselheiro1.id },
          { id: conselheiro2.id }
        ]
      }
    }
  })

  console.log('✅ Sessão de julgamento criada')

  // Criar decisões
  await prisma.decisao.createMany({
    data: [
      {
        processoId: processo2.id,
        sessaoId: sessao1.id,
        tipo: 'deferido',
        fundamentacao: 'A proposta de dação em pagamento atende aos requisitos legais e o valor do imóvel é compatível com o débito.',
        numeroAcordao: 'AC-2024-001',
        dataPublicacao: new Date('2024-11-22')
      },
      {
        processoId: processo3.id,
        sessaoId: sessao1.id,
        tipo: 'parcial',
        fundamentacao: 'Deferido o parcelamento em 60 meses com desconto de 20% sobre multas e juros.',
        numeroAcordao: 'AC-2024-002',
        dataPublicacao: new Date('2024-11-22')
      }
    ]
  })

  console.log('✅ Decisões criadas')

  // Criar acordos
  const acordo1 = await prisma.acordo.create({
    data: {
      processoId: processo2.id,
      numeroTermo: 'TERMO-2024-001',
      dataAssinatura: new Date('2024-11-25'),
      dataVencimento: new Date('2025-11-25'),
      valorTotal: 450000.00,
      valorDesconto: 50000.00,
      percentualDesconto: 10.00,
      valorFinal: 450000.00,
      modalidadePagamento: 'avista',
      numeroParcelas: 1,
      status: 'ativo',
      clausulasEspeciais: 'Transferência do imóvel em até 30 dias',
      observacoes: 'Acordo de dação em pagamento aprovado em sessão'
    }
  })

  const acordo2 = await prisma.acordo.create({
    data: {
      processoId: processo3.id,
      numeroTermo: 'TERMO-2024-002',
      dataAssinatura: new Date('2024-11-28'),
      dataVencimento: new Date('2029-11-28'),
      valorTotal: 1200000.00,
      valorDesconto: 300000.00,
      percentualDesconto: 20.00,
      valorFinal: 1200000.00,
      modalidadePagamento: 'parcelado',
      numeroParcelas: 60,
      valorEntrada: 50000.00,
      status: 'ativo',
      clausulasEspeciais: 'Desconto de 20% sobre multas e juros. Garantia real sobre faturamento.',
      observacoes: 'Parcelamento especial aprovado pela CCF'
    }
  })

  console.log('✅ Acordos criados')

  // Criar parcelas para o acordo parcelado
  const parcelas = []
  const valorParcela = (1200000.00 - 50000.00) / 60 // Valor total menos entrada dividido por 60

  for (let i = 1; i <= 60; i++) {
    const dataVencimento = new Date('2024-12-28')
    dataVencimento.setMonth(dataVencimento.getMonth() + i)
    
    let dataPagamento = null
    if (i === 1) dataPagamento = new Date('2025-01-28')
    if (i === 2) dataPagamento = new Date('2025-02-28')
    if (i === 3) dataPagamento = new Date('2025-03-28')
    
    parcelas.push({
      acordoId: acordo2.id,
      numero: i,
      valor: valorParcela,
      dataVencimento: dataVencimento,
      status: i <= 3 ? 'PAGO' : 'PENDENTE' as any,
      dataPagamento: dataPagamento
    })
  }

  await prisma.parcela.createMany({
    data: parcelas
  })

  console.log('✅ Parcelas criadas (60 parcelas, 3 já pagas)')

  // Criar pagamentos para as parcelas pagas
  const parcelasPagas = await prisma.parcela.findMany({
    where: {
      acordoId: acordo2.id,
      status: 'PAGO'
    }
  })

  for (const parcela of parcelasPagas) {
    await prisma.pagamentoParcela.create({
      data: {
        parcelaId: parcela.id,
        valorPago: parcela.valor,
        dataPagamento: parcela.dataPagamento!,
        formaPagamento: 'PIX',
        numeroComprovante: `COMP-2024-${parcela.numero.toString().padStart(3, '0')}`,
        observacoes: 'Pagamento realizado em dia'
      }
    })
  }

  console.log('✅ Pagamentos das parcelas registrados')

  // Criar logs de auditoria
  await prisma.logAuditoria.createMany({
    data: [
      {
        usuarioId: funcionario.id,
        acao: 'CREATE',
        entidade: 'Processo',
        entidadeId: processo1.id,
        dadosNovos: { numero: 'CCF-2024-001', tipo: 'COMPENSACAO' },
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0'
      },
      {
        usuarioId: admin.id,
        acao: 'UPDATE',
        entidade: 'Processo',
        entidadeId: processo2.id,
        dadosAnteriores: { status: 'EM_PAUTA' },
        dadosNovos: { status: 'ACORDO_FIRMADO' },
        ip: '192.168.1.101',
        userAgent: 'Mozilla/5.0'
      },
      {
        usuarioId: conselheiro1.id,
        acao: 'CREATE',
        entidade: 'Decisao',
        entidadeId: 'decisao-001',
        dadosNovos: { tipo: 'deferido', processo: 'CCF-2024-002' },
        ip: '192.168.1.102',
        userAgent: 'Mozilla/5.0'
      }
    ]
  })

  console.log('✅ Logs de auditoria criados')

  console.log('\n🎉 Banco de dados populado com sucesso!')
  console.log('\n📋 Resumo dos dados criados:')
  console.log('- 5 usuários (admin, funcionário, 2 conselheiros, visualizador)')
  console.log('- 5 setores')
  console.log('- 4 contribuintes')
  console.log('- 2 imóveis')
  console.log('- 2 créditos')
  console.log('- 5 processos em diferentes status')
  console.log('- 4 documentos anexados')
  console.log('- 3 tramitações')
  console.log('- 2 pautas (1 fechada com sessão, 1 aberta)')
  console.log('- 1 sessão de julgamento com ata')
  console.log('- 2 decisões')
  console.log('- 2 acordos (1 à vista, 1 parcelado em 60x)')
  console.log('- 60 parcelas (3 já pagas)')
  console.log('- 3 registros de pagamento')
  console.log('- 3 logs de auditoria')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Erro ao popular banco de dados:', e)
    await prisma.$disconnect()
    process.exit(1)
  })