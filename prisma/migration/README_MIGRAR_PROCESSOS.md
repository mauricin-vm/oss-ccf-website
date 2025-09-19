# Migração de Processos - Sistema Antigo CCF

Este script JavaScript converte a migração SQL original para um formato mais controlado e com melhor feedback.

## Arquivos

- `1-migrar_processos.sql` - Script SQL original (DBeaver)
- `1-migrar_processos.js` - Script JavaScript equivalente (Node.js)
- `README_MIGRAR_PROCESSOS.md` - Este arquivo

## Pré-requisitos

### 1. Dependências Node.js
```bash
npm install pg
# ou
yarn add pg
```

### 2. Configuração de Banco
- **Banco antigo**: 10.20.5.196:5432/sefin (postgres/admin)
- **Banco novo**: Configurado no Prisma (.env)

### 3. Acesso de Rede
- Certifique-se de que o servidor tem acesso ao IP 10.20.5.196

## Como usar

### Opção 1: Script JavaScript (Recomendado)
```bash
node prisma/migration/1-migrar_processos.js
```

**Vantagens:**
- ✅ Feedback em tempo real
- ✅ Controle de erros melhor
- ✅ Progress logging
- ✅ Validação de dados
- ✅ Transações automáticas

### Opção 2: Script SQL Original
```sql
-- No DBeaver conectado ao banco ccf_db
\i prisma/migration/1-migrar_processos.sql
```

## O que o script faz

### 1. **Preparação**
- Cria usuário de migração (`migracao_ccf@gov.br`)
- Remove dados antigos de migrações anteriores
- Conecta ao banco antigo via pg client

### 2. **Busca de Dados**
- Extrai processos da tabela `ccf."Processes"`
- Extrai contatos da tabela `ccf."Contacts"`
- Mapeia tipos de processo para o novo sistema

### 3. **Migração de Contribuintes**
```javascript
// Cria um contribuinte para cada processo
id: 'contrib_${id_processo}'
nome: nome do processo
cpfCnpj: limpo (apenas números)
email: primeiro email encontrado
telefone: primeiro telefone (apenas números)
```

### 4. **Migração de Processos**
```javascript
// Mapeia tipos:
COMPENSACAO → COMPENSACAO
DACAO/DAÇÃO → DACAO_PAGAMENTO
TRANSACAO/PARECER → TRANSACAO_EXCEPCIONAL

// Status: RECEPCIONADO (padrão)
// IDs: proc_${id_processo}
```

### 5. **Históricos e Logs**
- Cria `HistoricoProcesso` para cada processo migrado
- Cria `LogAuditoria` com ação 'MIGRATE'
- Usa datas originais do sistema antigo

## Mapeamento de Dados

### Tipos de Processo
| Sistema Antigo | Sistema Novo |
|----------------|--------------|
| COMPENSACAO, COMPENSAÇÃO, COMP | COMPENSACAO |
| DACAO, DAÇÃO, DACAO_PAGAMENTO | DACAO_PAGAMENTO |
| TRANSACAO, TRANSAÇÃO, PARECER | TRANSACAO_EXCEPCIONAL |

### Status
- Todos os processos → `RECEPCIONADO`
- Processos concluídos → `dataFinalizacao` preenchida

### Contatos
- Email: Primeiro contato tipo 'email'
- Telefone: Primeiro contato tipo 'telefone'
- CPF/CNPJ: Campo `cpfCnpj` da tabela Processes

## Logs e Feedback

O script JavaScript fornece:

```
🚀 Iniciando migração de processos...
🔌 Conectando ao banco antigo...
👤 Criando usuário de migração...
🧹 Limpando dados antigos...
📥 Buscando dados do banco antigo...
👥 Migrando contribuintes...
📄 Migrando processos...
📝 Criando históricos...
📋 Criando logs de auditoria...
🎉 MIGRAÇÃO CONCLUÍDA!
```

## Verificação

Após a migração, o script mostra:
- Total de registros migrados
- Amostra dos últimos 5 processos
- Verificação de integridade

## Troubleshooting

### Erro de Conexão
```bash
Error: connect ECONNREFUSED 10.20.5.196:5432
```
**Solução**: Verificar rede e credenciais

### Erro de Prisma
```bash
Error: Unknown argument in schema
```
**Solução**: Executar `npx prisma generate`

### Dados Duplicados
```bash
Unique constraint failed
```
**Solução**: O script limpa dados antigos automaticamente

## Performance

- **Processamento em lotes**: 100 registros por vez
- **Transações**: Cada operação é atomica
- **Tempo estimado**: ~2-5 minutos para 1000+ processos

## Reversão

Para reverter a migração:

```sql
DELETE FROM "LogAuditoria" WHERE id LIKE 'log_mig_%';
DELETE FROM "HistoricoProcesso" WHERE id LIKE 'hist_mig_%';
DELETE FROM "Processo" WHERE id LIKE 'proc_%';
DELETE FROM "Contribuinte" WHERE id LIKE 'contrib_%';
DELETE FROM "User" WHERE email = 'migracao_ccf@gov.br';
```