import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Criar usuário admin
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ccf.gov.br' },
    update: {},
    create: {
      email: 'admin@ccf.gov.br',
      name: 'Administrador',
      password: hashedPassword,
      role: 'ADMIN',
      active: true
    }
  })

  console.log('Usuário admin criado:', admin.email)

  // Criar usuário funcionário
  const funcionario = await prisma.user.upsert({
    where: { email: 'funcionario@ccf.gov.br' },
    update: {},
    create: {
      email: 'funcionario@ccf.gov.br',
      name: 'Funcionário Teste',
      password: await bcrypt.hash('func123', 10),
      role: 'FUNCIONARIO',
      active: true
    }
  })

  console.log('Usuário funcionário criado:', funcionario.email)

  // Criar usuário visualizador
  const visualizador = await prisma.user.upsert({
    where: { email: 'diretor@ccf.gov.br' },
    update: {},
    create: {
      email: 'diretor@ccf.gov.br',
      name: 'Diretor',
      password: await bcrypt.hash('diretor123', 10),
      role: 'VISUALIZADOR',
      active: true
    }
  })

  console.log('Usuário visualizador criado:', visualizador.email)

  // Criar setores
  const setores = [
    { nome: 'Câmara de Conciliação Fiscal', sigla: 'CCF' },
    { nome: 'Secretaria de Fazenda', sigla: 'SEFAZ' },
    { nome: 'Procuradoria Geral', sigla: 'PGM' },
    { nome: 'Secretaria de Urbanismo', sigla: 'SMU' },
    { nome: 'Secretaria de Administração', sigla: 'SMA' }
  ]

  for (const setor of setores) {
    await prisma.setor.upsert({
      where: { sigla: setor.sigla },
      update: {},
      create: setor
    })
  }

  console.log('Setores criados')

  // Criar contribuinte de exemplo
  const contribuinte = await prisma.contribuinte.create({
    data: {
      cpfCnpj: '12345678901',
      nome: 'João da Silva',
      email: 'joao@email.com',
      telefone: '11999999999',
      endereco: 'Rua Exemplo, 123',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01234567'
    }
  })

  // Criar processo de exemplo
  const processo = await prisma.processo.create({
    data: {
      numero: 'CCF-2024-001',
      tipo: 'COMPENSACAO',
      status: 'RECEPCIONADO',
      valorOriginal: 150000.00,
      observacoes: 'Processo de compensação de precatórios',
      contribuinteId: contribuinte.id,
      createdById: funcionario.id
    }
  })

  console.log('Processo de exemplo criado:', processo.numero)

  // Criar tramitação inicial
  await prisma.tramitacao.create({
    data: {
      processoId: processo.id,
      setorOrigem: 'CCF',
      setorDestino: 'SEFAZ',
      prazoResposta: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 dias
      observacoes: 'Enviado para análise fiscal',
      usuarioId: funcionario.id
    }
  })

  console.log('Dados de seed inseridos com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })