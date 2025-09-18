# Modelo de Dados - Sistema CCF

## 📊 Visão Geral do Banco de Dados

O sistema CCF utiliza PostgreSQL como banco de dados relacional, gerenciado através do Prisma ORM. O modelo foi projetado para suportar os três tipos principais de processos da Câmara de Conciliação Fiscal: Compensação, Dação em Pagamento e Transação Excepcional.

## 🗄️ Estrutura Principal

### Diagrama de Relacionamentos

```
User ────────┐
             │
             ├─ Processo ────┬─ Contribuinte
             │               ├─ Tramitacao
             │               ├─ Documento
             │               ├─ ProcessoPauta ─── Pauta ─── SessaoJulgamento
             │               ├─ Decisao ────────┬─ Voto ─── Conselheiro
             │               ├─ Acordo ─────────┼─ Parcela ─── PagamentoParcela
             │               │                  └─ AcordoDetalhes ─── AcordoInscricao
             │               ├─ ProcessoImovel ─── Imovel
             │               ├─ ProcessoCredito ── Credito
             │               ├─ ProcessoInscricao ─ ProcessoDebito
             │               ├─ HistoricoProcesso
             │               └─ TransacaoExcepcional ─── PropostaTransacao
             │
             └─ LogAuditoria
```

## 📋 Tabelas e Relacionamentos Detalhados

### 1. Tabelas de Autenticação e Usuários

#### `User` - Usuários do Sistema
```sql
User {
  id: String (PK)
  email: String (UNIQUE)
  name: String
  password: String (encrypted)
  role: Role (ADMIN | FUNCIONARIO | VISUALIZADOR)
  active: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Relacionamentos:**
- `1:N` com `Processo` (criador)
- `1:N` com `Tramitacao` (responsável)
- `1:N` com `LogAuditoria` (ações do usuário)
- `1:N` com `HistoricoProcesso` (alterações feitas)
- `1:N` com `HistoricoPauta` (alterações em pautas)

---

### 2. Entidades Principais

#### `Contribuinte` - Pessoas Físicas/Jurídicas
```sql
Contribuinte {
  id: String (PK)
  cpfCnpj: String (indexed)
  nome: String
  email: String
  telefone: String
  endereco: String
  cidade: String
  estado: String
  cep: String
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Relacionamentos:**
- `1:N` com `Processo` (titular do processo)
- `1:N` com `Imovel` (proprietário)

#### `Processo` - Processo Principal
```sql
Processo {
  id: String (PK)
  numero: String (UNIQUE)
  tipo: TipoProcesso (COMPENSACAO | DACAO_PAGAMENTO | TRANSACAO_EXCEPCIONAL)
  status: StatusProcesso (indexed)
  dataAbertura: DateTime
  dataFinalizacao: DateTime
  observacoes: Text
  contribuinteId: String (FK)
  createdById: String (FK)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Relacionamentos:**
- `N:1` com `Contribuinte`
- `N:1` com `User` (criador)
- `1:N` com `Tramitacao`
- `1:N` com `Documento`
- `1:N` com `ProcessoPauta`
- `1:N` com `Decisao`
- `1:N` com `Acordo`
- `1:N` com `ProcessoImovel`
- `1:N` com `ProcessoCredito`
- `1:N` com `ProcessoInscricao`
- `1:N` com `HistoricoProcesso`
- `1:1` com `TransacaoExcepcional`

---

### 3. Sistema de Tramitação

#### `Tramitacao` - Movimentação entre Setores
```sql
Tramitacao {
  id: String (PK)
  processoId: String (FK, indexed)
  setorOrigem: String
  setorDestino: String
  dataEnvio: DateTime
  dataRecebimento: DateTime
  prazoResposta: DateTime
  observacoes: Text
  usuarioId: String (FK, indexed)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `Setor` - Setores da Organização
```sql
Setor {
  id: String (PK)
  nome: String (UNIQUE)
  sigla: String (UNIQUE)
  email: String
  responsavel: String
  ativo: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### 4. Sistema de Documentos

#### `Documento` - Arquivos do Processo
```sql
Documento {
  id: String (PK)
  processoId: String (FK, indexed)
  nome: String
  tipo: String
  url: String
  tamanho: Int
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### 5. Sistema de Pautas e Julgamentos

#### `Pauta` - Pautas de Julgamento
```sql
Pauta {
  id: String (PK)
  numero: String (UNIQUE)
  dataPauta: DateTime
  status: String (aberta | em_julgamento | fechada)
  observacoes: Text
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `ProcessoPauta` - Processos em Pauta
```sql
ProcessoPauta {
  id: String (PK)
  processoId: String (FK, indexed)
  pautaId: String (FK, indexed)
  ordem: Int
  relator: String
  distribuidoPara: String
  revisores: String[]
  statusSessao: TipoResultadoJulgamento
  ataTexto: Text
  motivoSuspensao: Text
  prazoVista: DateTime
  prazoDiligencia: Int
  observacoesSessao: Text
}
```

#### `SessaoJulgamento` - Sessões de Julgamento
```sql
SessaoJulgamento {
  id: String (PK)
  pautaId: String (FK, UNIQUE) // Opcional para sessões administrativas
  dataInicio: DateTime
  dataFim: DateTime
  ata: Text
  numeroAta: String
  agenda: Text // Agenda para sessões administrativas
  tipoSessao: String // "julgamento" | "administrativa"
  assuntosAdministrativos: Text
  presidenteId: String (FK)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Tipos de Sessão:**
- **Sessão de Julgamento**: Vinculada a uma pauta (`pautaId` obrigatório), foca no julgamento de processos
- **Sessão Administrativa**: Independente de pauta (`pautaId` null), utiliza campo `agenda` para assuntos administrativos

#### `Conselheiro` - Conselheiros
```sql
Conselheiro {
  id: String (PK)
  nome: String
  email: String
  telefone: String
  cargo: String
  origem: String
  ativo: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Relacionamentos:**
- `N:N` com `SessaoJulgamento` (participantes)
- `1:N` com `SessaoJulgamento` (presidente)
- `1:N` com `Voto`

---

### 6. Sistema de Decisões e Votos

#### `Decisao` - Decisões dos Processos
```sql
Decisao {
  id: String (PK)
  processoId: String (FK, indexed)
  sessaoId: String (FK, indexed)
  tipoResultado: TipoResultadoJulgamento
  tipoDecisao: TipoDecisao (DEFERIDO | INDEFERIDO | PARCIAL)
  observacoes: Text
  dataDecisao: DateTime
  numeroAcordao: String (UNIQUE)
  dataPublicacao: DateTime
  motivoSuspensao: Text
  detalhesNegociacao: Text
  conselheiroPedidoVista: String
  prazoVista: DateTime
  especificacaoDiligencia: Text
  prazoDiligencia: Int
  definirAcordo: Boolean
  tipoAcordo: String
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `Voto` - Votos dos Conselheiros
```sql
Voto {
  id: String (PK)
  decisaoId: String (FK, indexed)
  conselheiroId: String (FK, indexed)
  tipoVoto: TipoVoto (RELATOR | REVISOR | CONSELHEIRO)
  nomeVotante: String
  textoVoto: Text
  posicaoVoto: PosicaoVoto (DEFERIDO | INDEFERIDO | PARCIAL | ABSTENCAO | AUSENTE | IMPEDIDO)
  acompanhaVoto: String
  ordemApresentacao: Int
  isPresidente: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### 7. Sistema de Acordos

#### `Acordo` - Acordos de Pagamento
```sql
Acordo {
  id: String (PK)
  processoId: String (FK)
  numeroTermo: String (UNIQUE)
  dataAssinatura: DateTime
  dataVencimento: DateTime
  valorTotal: Decimal(15,2)
  valorDesconto: Decimal(15,2)
  percentualDesconto: Decimal(5,2)
  valorFinal: Decimal(15,2)
  modalidadePagamento: String (avista | parcelado)
  numeroParcelas: Int
  valorEntrada: Decimal(15,2)
  status: String (ativo | cumprido | vencido | cancelado | renegociado)
  clausulasEspeciais: Text
  observacoes: Text
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `AcordoDetalhes` - Detalhes dos Acordos
```sql
AcordoDetalhes {
  id: String (PK)
  acordoId: String (FK, indexed)
  tipo: String (dacao | compensacao | transacao)
  descricao: String
  valorOriginal: Decimal(15,2)
  valorNegociado: Decimal(15,2)
  status: StatusAcordoDetalhe (PENDENTE | APROVADO | EXECUTADO | CANCELADO)
  dataExecucao: DateTime
  observacoes: Text
  imovelId: String (FK)
  creditoId: String (FK)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `AcordoInscricao` - Inscrições do Acordo
```sql
AcordoInscricao {
  id: String (PK)
  acordoDetalheId: String (FK, indexed)
  numeroInscricao: String (indexed)
  tipoInscricao: String (imobiliaria | economica)
  valorDebito: Decimal(15,2)
  valorAbatido: Decimal(15,2)
  percentualAbatido: Decimal(5,2)
  situacao: String (pendente | abatido | quitado)
  descricaoDebitos: Json
}
```

---

### 8. Sistema de Pagamentos

#### `Parcela` - Parcelas dos Acordos
```sql
Parcela {
  id: String (PK)
  acordoId: String (FK, indexed)
  numero: Int
  valor: Decimal(15,2)
  dataVencimento: DateTime
  dataPagamento: DateTime
  status: StatusPagamento (PENDENTE | PAGO | ATRASADO | CANCELADO)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `PagamentoParcela` - Pagamentos Realizados
```sql
PagamentoParcela {
  id: String (PK)
  parcelaId: String (FK, indexed)
  valorPago: Decimal(15,2)
  dataPagamento: DateTime (indexed)
  formaPagamento: String (PIX | TED | DINHEIRO)
  numeroComprovante: String
  observacoes: Text
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### 9. Entidades Específicas por Tipo de Processo

#### Para Compensação

##### `ProcessoInscricao` - Inscrições do Processo
```sql
ProcessoInscricao {
  id: String (PK)
  processoId: String (FK, indexed)
  numeroInscricao: String (indexed)
  tipoInscricao: String (imobiliaria | economica)
  createdAt: DateTime
  updatedAt: DateTime
}
```

##### `ProcessoDebito` - Débitos das Inscrições
```sql
ProcessoDebito {
  id: String (PK)
  inscricaoId: String (FK, indexed)
  descricao: String
  valor: Decimal(15,2)
  dataVencimento: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

##### `Credito` - Créditos Disponíveis
```sql
Credito {
  id: String (PK)
  tipo: String (precatorio | credito_tributario)
  numero: String (UNIQUE)
  valor: Decimal(15,2)
  dataVencimento: DateTime
  descricao: Text
  createdAt: DateTime
  updatedAt: DateTime
}
```

##### `ProcessoCredito` - Relação Processo-Crédito
```sql
ProcessoCredito {
  id: String (PK)
  processoId: String (FK, indexed)
  creditoId: String (FK, indexed)
  valorUtilizado: Decimal(15,2)
}
```

#### Para Dação em Pagamento

##### `Imovel` - Imóveis
```sql
Imovel {
  id: String (PK)
  matricula: String (UNIQUE)
  endereco: String
  cidade: String
  estado: String
  valorAvaliado: Decimal(15,2)
  descricao: Text
  proprietarioId: String (FK, indexed)
  createdAt: DateTime
  updatedAt: DateTime
}
```

##### `ProcessoImovel` - Relação Processo-Imóvel
```sql
ProcessoImovel {
  id: String (PK)
  processoId: String (FK, indexed)
  imovelId: String (FK, indexed)
  tipoRelacao: String (garantia | dacao)
}
```

#### Para Transação Excepcional

##### `TransacaoExcepcional` - Transações Excepcionais
```sql
TransacaoExcepcional {
  id: String (PK)
  processoId: String (FK, UNIQUE, indexed)
  valorTotalInscricoes: Decimal(15,2)
  valorTotalProposto: Decimal(15,2)
  valorDesconto: Decimal(15,2)
  percentualDesconto: Decimal(5,2)
  createdAt: DateTime
  updatedAt: DateTime
}
```

##### `PropostaTransacao` - Propostas de Transação
```sql
PropostaTransacao {
  id: String (PK)
  transacaoId: String (FK, UNIQUE, indexed)
  valorTotalProposto: Decimal(15,2)
  metodoPagamento: MetodoPagamento (A_VISTA | PARCELADO)
  valorEntrada: Decimal(15,2)
  quantidadeParcelas: Int
  valorParcela: Decimal(15,2)
  observacoes: Text
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### 10. Sistema de Auditoria e Histórico

#### `LogAuditoria` - Logs de Auditoria
```sql
LogAuditoria {
  id: String (PK)
  usuarioId: String (FK, indexed)
  acao: String
  entidade: String (indexed)
  entidadeId: String (indexed)
  dadosAnteriores: Json
  dadosNovos: Json
  ip: String
  userAgent: String
  createdAt: DateTime
}
```

#### `HistoricoProcesso` - Histórico dos Processos
```sql
HistoricoProcesso {
  id: String (PK)
  processoId: String (FK, indexed)
  usuarioId: String (FK, indexed)
  titulo: String
  descricao: String
  tipo: String (EVENTO | OBSERVACAO | ALTERACAO)
  createdAt: DateTime (indexed)
}
```

#### `HistoricoPauta` - Histórico das Pautas
```sql
HistoricoPauta {
  id: String (PK)
  pautaId: String (FK, indexed)
  usuarioId: String (FK, indexed)
  titulo: String
  descricao: String
  tipo: String (EVENTO | PROCESSO_ADICIONADO | PROCESSO_REMOVIDO | ALTERACAO)
  createdAt: DateTime (indexed)
}
```

---

## 🔧 Índices e Performance

### Índices Principais
```sql
-- Índices por relacionamento
INDEX idx_processo_contribuinte ON Processo(contribuinteId)
INDEX idx_processo_status ON Processo(status)
INDEX idx_processo_tipo ON Processo(tipo)

-- Índices por busca
INDEX idx_contribuinte_cpfcnpj ON Contribuinte(cpfCnpj)
INDEX idx_tramitacao_processo ON Tramitacao(processoId)
INDEX idx_tramitacao_usuario ON Tramitacao(usuarioId)

-- Índices por performance
INDEX idx_parcela_status ON Parcela(status)
INDEX idx_acordo_detalhe_tipo ON AcordoDetalhes(tipo)
INDEX idx_acordo_detalhe_status ON AcordoDetalhes(status)

-- Índices por auditoria
INDEX idx_log_entidade ON LogAuditoria(entidade, entidadeId)
INDEX idx_historico_data ON HistoricoProcesso(createdAt)
```

## 📊 Enums Utilizados

### Roles do Sistema
```typescript
enum Role {
  ADMIN          // Acesso total
  FUNCIONARIO    // Criação e edição
  VISUALIZADOR   // Apenas visualização
}
```

### Status do Processo
```typescript
enum StatusProcesso {
  RECEPCIONADO         // Processo recebido
  EM_ANALISE          // Em análise técnica
  EM_PAUTA            // Incluído em pauta
  SUSPENSO            // Suspenso por decisão
  PEDIDO_VISTA        // Vista solicitada
  PEDIDO_DILIGENCIA   // Diligência solicitada
  EM_NEGOCIACAO       // Acordo em negociação
  JULGADO             // Processo julgado
  EM_CUMPRIMENTO      // Acordo em cumprimento
  CONCLUIDO           // Processo finalizado
}
```

### Tipos de Processo
```typescript
enum TipoProcesso {
  COMPENSACAO           // Compensação de créditos
  DACAO_PAGAMENTO      // Dação em pagamento
  TRANSACAO_EXCEPCIONAL // Transação excepcional
}
```

### Tipos de Decisão
```typescript
enum TipoDecisao {
  DEFERIDO    // Aprovado
  INDEFERIDO  // Negado
  PARCIAL     // Parcialmente aprovado
}
```

## 🔄 Fluxos de Dados Principais

### 1. Fluxo de Criação de Processo
```
Contribuinte → Processo → Documentos → Tramitação → Pauta → Sessão → Decisão → Acordo
```

### 2. Fluxo de Compensação
```
Processo → ProcessoInscricao → ProcessoDebito
         → ProcessoCredito → Credito
         → Acordo → AcordoDetalhes → AcordoInscricao
```

### 3. Fluxo de Dação
```
Processo → Imovel → ProcessoImovel
         → Acordo → AcordoDetalhes
```

### 4. Fluxo de Transação Excepcional
```
Processo → TransacaoExcepcional → PropostaTransacao
         → Acordo → Parcela → PagamentoParcela
```

### 5. Fluxo de Sessões
```
// Sessão de Julgamento
Pauta → SessaoJulgamento → Decisao → Voto

// Sessão Administrativa
SessaoJulgamento (sem pauta) → Agenda → Ata
```

**Sessões Administrativas:**
- Não requerem pauta de processos
- Utilizam campo `agenda` para definir assuntos
- Focam em questões administrativas da CCF
- Podem ser realizadas independentemente dos processos

---

**Documentação do Modelo de Dados - Sistema CCF**
*Atualizado em: Setembro 2025*