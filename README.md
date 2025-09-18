# Sistema CCF - Câmara de Conciliação Fiscal

## 📋 Sobre o Projeto

O Sistema CCF é uma aplicação web completa para gerenciamento de processos da Câmara de Conciliação Fiscal. O sistema permite o controle integral de processos tributários, incluindo compensações, dações em pagamento e transações excepcionais, com funcionalidades para tramitação, julgamento, acordos e acompanhamento de pagamentos.

## 🚀 Tecnologias Utilizadas

### Frontend
- **Next.js 15.5.3** - Framework React com App Router
- **React 19.1.0** - Biblioteca para interfaces de usuário
- **TypeScript** - Linguagem com tipagem estática
- **Tailwind CSS 4** - Framework CSS utilitário
- **Radix UI** - Componentes de interface acessíveis
- **Lucide React** - Biblioteca de ícones
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schemas
- **Recharts** - Biblioteca de gráficos
- **Sonner** - Sistema de notificações toast
- **date-fns** - Manipulação de datas
- **Next Themes** - Suporte a temas

### Backend & Banco de Dados
- **Prisma** - ORM para banco de dados
- **PostgreSQL** - Banco de dados relacional
- **NextAuth.js** - Autenticação e autorização
- **bcryptjs** - Criptografia de senhas

### Ferramentas de Desenvolvimento
- **ESLint** - Linting de código
- **tsx** - TypeScript execution engine
- **Turbopack** - Bundler de alta performance

## 🏗️ Arquitetura do Sistema

### Estrutura de Pastas

```
ccf-sistema/
├── app/                          # App Router do Next.js
│   ├── (authenticated)/          # Rotas protegidas
│   │   ├── dashboard/            # Dashboard principal
│   │   ├── processos/            # Gestão de processos
│   │   ├── acordos/              # Gestão de acordos
│   │   ├── tramitacoes/          # Tramitação de processos
│   │   ├── pautas/               # Pautas de julgamento
│   │   ├── sessoes/              # Sessões de julgamento
│   │   ├── admin/                # Área administrativa
│   │   └── relatorios/           # Relatórios e estatísticas
│   ├── api/                      # API Routes
│   ├── login/                    # Página de login
│   └── globals.css               # Estilos globais
├── components/                   # Componentes React
│   ├── ui/                       # Componentes de interface
│   ├── forms/                    # Formulários
│   ├── modals/                   # Modais
│   ├── charts/                   # Gráficos
│   ├── layout/                   # Layout e navegação
│   └── providers/                # Providers de contexto
├── lib/                          # Utilitários e configurações
│   ├── auth/                     # Configuração de autenticação
│   ├── constants/                # Constantes do sistema
│   ├── utils/                    # Funções utilitárias
│   └── validations/              # Schemas de validação
├── prisma/                       # Schema e migrações do banco
├── types/                        # Definições de tipos TypeScript
└── middleware.ts                 # Middleware de autenticação
```

## 🎯 Principais Funcionalidades

### 1. Gestão de Processos
- **Tipos de Processo:**
  - Compensação de créditos tributários
  - Dação em pagamento de imóveis
  - Transação excepcional
- **Controle de Status:** Recepcionado, Em Análise, Em Pauta, Suspenso, Julgado, etc.
- **Documentação:** Upload e gestão de documentos
- **Histórico:** Rastreamento completo de alterações

### 2. Sistema de Tramitação
- Tramitação entre setores
- Controle de prazos de resposta
- Notificações automáticas
- Histórico de movimentações

### 3. Pautas e Sessões de Julgamento
- Criação e gestão de pautas
- Distribuição de processos para relatores
- Controle de sessões de julgamento
- Registro de decisões e votos
- Geração de atas automáticas

### 4. Sistema de Acordos
- **Compensação:** Utilização de créditos para quitação de débitos
- **Dação em Pagamento:** Transferência de imóveis
- **Transação Excepcional:** Acordos de pagamento parcelado
- Controle de parcelas e pagamentos
- Acompanhamento de cumprimento

### 5. Relatórios e Dashboard
- Dashboard com métricas em tempo real
- Gráficos de evolução de processos
- Relatórios personalizáveis
- Estatísticas por tipo e status

### 6. Administração
- Gestão de usuários e permissões
- Cadastro de conselheiros
- Configuração de setores
- Logs de auditoria
- Backup de dados

## 👥 Sistema de Permissões

### Perfis de Usuário
- **ADMIN:** Acesso total ao sistema
- **FUNCIONARIO:** Criação e edição de processos e acordos
- **VISUALIZADOR:** Apenas visualização de dados

### Controle de Acesso
- Autenticação via NextAuth.js
- Middleware para proteção de rotas
- Sessões JWT com validade de 30 dias
- Validação de sessão em tempo real

## 🚦 Como Executar

### Pré-requisitos
- Node.js 18+
- PostgreSQL
- npm ou yarn

### Variáveis de Ambiente
Crie um arquivo `.env.local` com:

```env
# Database
DATABASE_URL="postgresql://usuario:senha@localhost:5432/ccf_db"

# NextAuth
NEXTAUTH_SECRET="seu-secret-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Node Environment
NODE_ENV="development"
```

### Instalação e Execução

1. **Clone o repositório:**
```bash
git clone [url-do-repositorio]
cd oss-ccf-website
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o banco de dados:**
```bash
# Gerar o cliente Prisma
npx prisma generate

# Executar migrações
npx prisma db push

# (Opcional) Visualizar banco de dados
npx prisma studio
```

4. **Execute o servidor de desenvolvimento:**
```bash
npm run dev
```

5. **Acesse a aplicação:**
```
http://localhost:3000
```

### Scripts Disponíveis

```bash
# Desenvolvimento com Turbopack
npm run dev

# Build de produção
npm run build

# Servidor de produção
npm run start

# Linting
npm run lint

# Limpar banco de dados
npm run db:clear
```

## 📊 Funcionalidades por Módulo

### Dashboard
- Cards com estatísticas principais
- Lista de processos recentes
- Indicadores de performance
- Atalhos rápidos

### Processos
- Listagem com filtros avançados
- Formulários para diferentes tipos
- Upload de documentos
- Controle de status
- Histórico detalhado

### Acordos
- Visualização por tipo de processo
- Controle de pagamentos
- Cálculo automático de valores
- Acompanhamento de vencimentos
- Relatórios de inadimplência

### Tramitações
- Envio entre setores
- Controle de prazos
- Notificações automáticas
- Histórico de movimentações

### Pautas e Sessões
- Criação de pautas
- Distribuição para relatores
- Controle de sessões
- Registro de decisões
- Votação eletrônica
- Geração de atas

### Administração
- Gestão completa de usuários
- Configuração de permissões
- Cadastro de entidades
- Logs de auditoria
- Configurações do sistema

## 🔧 Configurações de Desenvolvimento

### ESLint
O projeto utiliza configuração personalizada do ESLint com:
- Regras do Next.js
- TypeScript support
- Configurações customizadas

### Tailwind CSS
- Configuração com variáveis CSS customizadas
- Plugins para animações
- Temas dark/light suportados

### Prisma
- Schema completo do banco de dados
- Relacionamentos complexos
- Índices otimizados
- Enums para tipos específicos

## 🚀 Deploy

### Produção
1. Configure as variáveis de ambiente de produção
2. Execute o build: `npm run build`
3. Inicie o servidor: `npm start`

### Considerações
- Configure HTTPS em produção
- Configure backup automático do banco
- Configure monitoramento de logs
- Configure CDN para assets estáticos

## 🤝 Contribuição

Para contribuir com o projeto:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

**Sistema CCF** - Modernizando a gestão da Câmara de Conciliação Fiscal<br>
**Feito por:** Maurício Valente Martins e Tiago Amado Vera Veron