# Migração de Pautas - Sistema Antigo CCF

Este diretório contém os scripts para migrar as pautas/sessões do sistema antigo da CCF para o novo sistema.

## Arquivos

- `data-old-db.json` - Dados extraídos do sistema antigo (207 sessões desde 2019)
- `verificar_dados_pautas.js` - Script para verificar dados antes da migração
- `migrar_pautas.js` - Script principal de migração
- `README_PAUTAS.md` - Este arquivo

## Como usar

### 1. Verificar dados antes da migração

```bash
node prisma/migration/verificar_dados_pautas.js
```

Este script irá:
- Contar quantas sessões têm processos para migrar
- Verificar se todos os conselheiros mencionados existem no banco
- Verificar se todos os processos mencionados existem no banco
- Mostrar estatísticas gerais dos dados

### 2. Executar a migração

```bash
node prisma/migration/migrar_pautas.js
```

Este script irá:
- Filtrar apenas sessões que têm processos
- Criar pautas para cada sessão
- Ordenar processos por nome do relator (ordem alfabética)
- Criar registros ProcessoPauta com relator e revisor
- Criar sessões de julgamento associadas
- Criar histórico das pautas

## Lógica da Migração

### Campos criados automaticamente:

- **observacoes**: "Pauta criada por migração automática de dados."
- **numero**: "Pauta DD-MM-AAAA - XXXX/AAAA" (baseado na data da sessão)
- **status**: "fechada" (sessões antigas são consideradas concluídas)
- **ordem dos processos**: Ordenação alfabética por nome do relator

### Correspondências:

- **Conselheiros**: Busca por nome exato, depois por primeiro+segundo nome, depois por partes do nome
- **Processos**: Busca por número exato na tabela Processo
- **Resultados**: Mapeamento para enum TipoResultadoJulgamento:
  - "Suspenso" → SUSPENSO
  - "Pedido de Vista" → PEDIDO_VISTA
  - "Pedido de Diligência" → PEDIDO_DILIGENCIA
  - "Em Negociação" → EM_NEGOCIACAO
  - "Julgado" → JULGADO

### Dados criados:

1. **Pauta**
   - Número único baseado na data + número da ata
   - Data da pauta = data da sessão original
   - Status "fechada"
   - Observações padronizadas

2. **ProcessoPauta**
   - Ordem baseada em ordenação alfabética do relator
   - Relator e distribuidoPara = nome do relator original
   - Revisores = array com nome do revisor (se houver)
   - StatusSessao = resultado convertido para enum

3. **SessaoJulgamento**
   - Tipo = JULGAMENTO
   - Presidente = conselheiro presidente da sessão
   - Conselheiros participantes = IDs dos conselheiros
   - Data início = data fim = data da sessão

4. **HistoricoPauta**
   - Registro de criação por migração
   - Data = data da pauta original
   - Usuário = primeiro ADMIN do sistema

## Estatísticas Esperadas

- Total de sessões: 207
- Sessões com processos: ~50-60
- Total de processos: varia conforme os dados
- Conselheiros únicos: ~15-20
- Tipos de resultado: 5-6 diferentes

## Tratamento de Erros

O script possui tratamento para:
- Conselheiros não encontrados (tenta busca por aproximação)
- Processos não encontrados (registra erro mas continua)
- Resultados não mapeados (usa JULGADO como padrão)
- Pautas duplicadas (pula se já existe)

## Logs

Durante a execução, o script mostra:
- ✅ Sucessos (pautas criadas, processos migrados)
- ⚠️ Avisos (aproximações de nomes, mapeamentos padrão)
- ❌ Erros (dados não encontrados)
- 📊 Estatísticas finais

## Reversão

Para reverter a migração (se necessário):

```sql
-- Deletar registros criados pela migração
DELETE FROM "HistoricoPauta" WHERE descricao LIKE '%migrada automaticamente%';
DELETE FROM "SessaoJulgamento" WHERE ata LIKE '%Migrada automaticamente%';
DELETE FROM "ProcessoPauta" WHERE "pautaId" IN (
  SELECT id FROM "Pauta" WHERE observacoes = 'Pauta criada por migração automática de dados.'
);
DELETE FROM "Pauta" WHERE observacoes = 'Pauta criada por migração automática de dados.';
```

## Requisitos

- Node.js instalado
- Prisma Client configurado
- Banco de dados com tabelas criadas
- Dados de conselheiros e processos já migrados
- Pelo menos um usuário ADMIN no sistema