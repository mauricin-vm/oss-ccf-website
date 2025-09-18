-- ============================================================================
-- MIGRAÇÃO DOS HISTÓRICOS (SITUATIONS) DO SISTEMA ANTIGO
-- ============================================================================
-- Migra dados da tabela ccf."Situations" para "HistoricoProcesso" no novo sistema
-- Execute no banco ccf_db remoto (10.20.5.196)
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR CONEXÃO E DADOS EXISTENTES
-- ============================================================================

SELECT
    'VERIFICAÇÃO INICIAL' as titulo,
    current_database() as banco_atual,
    inet_server_addr() as ip_servidor;

-- Contar históricos atuais
SELECT
    'Históricos atuais no sistema' as status,
    COUNT(*) as quantidade
FROM "HistoricoProcesso";

-- ============================================================================
-- 2. PREPARAR EXTENSÃO DBLINK
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS dblink;

-- ============================================================================
-- 3. VERIFICAR DADOS DE SITUATIONS NO BANCO ANTIGO
-- ============================================================================

SELECT 'Verificando dados de Situations no banco antigo...' as status;

SELECT *
FROM dblink(
    'host=10.20.5.196 port=5432 dbname=sefin user=postgres password=admin',
    'SELECT COUNT(*) as total_situations FROM ccf."Situations"'
) AS resultado(total_situations BIGINT);

-- Amostra de dados
SELECT 'Amostra de Situations:' as titulo;

SELECT *
FROM dblink(
    'host=10.20.5.196 port=5432 dbname=sefin user=postgres password=admin',
    '
    SELECT
        s._id::INTEGER as situation_id,
        s."processId"::INTEGER as process_id,
        s.title::VARCHAR as titulo,
        s.situation::TEXT as situacao,
        s."createdAt"::TIMESTAMP as data_criacao,
        p.process::VARCHAR as numero_processo
    FROM ccf."Situations" s
    JOIN ccf."Processes" p ON s."processId" = p._id
    ORDER BY s."createdAt" DESC
    LIMIT 10
    '
) AS dados(
    situation_id INTEGER,
    process_id INTEGER,
    titulo VARCHAR,
    situacao TEXT,
    data_criacao TIMESTAMP,
    numero_processo VARCHAR
);

-- ============================================================================
-- 4. MIGRAR SITUATIONS PARA HISTORICOPROCESSO
-- ============================================================================

SELECT 'Iniciando migração de Situations para HistoricoProcesso...' as status;

INSERT INTO "HistoricoProcesso" (
    id,
    "processoId",
    "usuarioId",
    titulo,
    descricao,
    tipo,
    "createdAt"
)
SELECT
    'hist_sit_' || dados.situation_id AS id,
    'proc_' || dados.process_id AS "processoId",
    COALESCE(
        (SELECT id FROM "User" WHERE email = 'migracao_ccf@gov.br' LIMIT 1),
        (SELECT id FROM "User" LIMIT 1)
    ) AS "usuarioId",
    dados.titulo AS titulo,
    dados.situacao AS descricao,
    'EVENTO' AS tipo,
    dados.data_criacao AS "createdAt"
FROM dblink(
    'host=10.20.5.196 port=5432 dbname=sefin user=postgres password=admin',
    '
    SELECT
        s._id::INTEGER as situation_id,
        s."processId"::INTEGER as process_id,
        s.title::VARCHAR as titulo,
        s.situation::TEXT as situacao,
        s."createdAt"::TIMESTAMP as data_criacao
    FROM ccf."Situations" s
    WHERE s.title IS NOT NULL
      AND s.situation IS NOT NULL
    ORDER BY s."createdAt" ASC
    '
) AS dados(
    situation_id INTEGER,
    process_id INTEGER,
    titulo VARCHAR,
    situacao TEXT,
    data_criacao TIMESTAMP
)
-- Apenas inserir se o processo correspondente existe no novo sistema
WHERE EXISTS (
    SELECT 1 FROM "Processo"
    WHERE id = 'proc_' || dados.process_id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. VERIFICAR HISTÓRICOS MIGRADOS
-- ============================================================================

SELECT 'Históricos migrados de Situations:' as status, COUNT(*) as quantidade
FROM "HistoricoProcesso" WHERE id LIKE 'hist_sit_%';

-- ============================================================================
-- 6. CRIAR LOGS DE AUDITORIA PARA A MIGRAÇÃO DE HISTÓRICOS
-- ============================================================================

INSERT INTO "LogAuditoria" (
    id,
    "usuarioId",
    acao,
    entidade,
    "entidadeId",
    "dadosNovos",
    "createdAt"
)
SELECT
    'log_hist_mig_' || h.id AS id,
    h."usuarioId" AS "usuarioId",
    'MIGRATE_HISTORY' AS acao,
    'HistoricoProcesso' AS entidade,
    h.id AS "entidadeId",
    jsonb_build_object(
        'titulo', h.titulo,
        'tipo', h.tipo,
        'origem', 'situations_sistema_antigo',
        'data_migracao', now()
    ) AS "dadosNovos",
    now() AS "createdAt"
FROM "HistoricoProcesso" h
WHERE h.id LIKE 'hist_sit_%'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. RELATÓRIOS E ESTATÍSTICAS
-- ============================================================================

SELECT 'RELATÓRIO DA MIGRAÇÃO DE HISTÓRICOS' as titulo;

-- Estatísticas gerais
SELECT
    'Total de históricos no sistema' as categoria,
    COUNT(*) as quantidade
FROM "HistoricoProcesso"

UNION ALL SELECT
    'Históricos migrados (Situations)' as categoria,
    COUNT(*) as quantidade
FROM "HistoricoProcesso" WHERE id LIKE 'hist_sit_%'

UNION ALL SELECT
    'Históricos de migração de processo' as categoria,
    COUNT(*) as quantidade
FROM "HistoricoProcesso" WHERE id LIKE 'hist_mig_%'

UNION ALL SELECT
    'Logs de auditoria de históricos' as categoria,
    COUNT(*) as quantidade
FROM "LogAuditoria" WHERE id LIKE 'log_hist_mig_%';

-- Históricos por tipo
SELECT 'Históricos por tipo:' as titulo;

SELECT
    'Tipo: ' || tipo as categoria,
    COUNT(*) as quantidade
FROM "HistoricoProcesso"
WHERE id LIKE 'hist_sit_%'
GROUP BY tipo
ORDER BY quantidade DESC;

-- Históricos por processo (top 10)
SELECT 'Top 10 processos com mais históricos:' as titulo;

SELECT
    p.numero as "Número do Processo",
    COUNT(h.id) as "Quantidade de Históricos"
FROM "HistoricoProcesso" h
JOIN "Processo" p ON h."processoId" = p.id
WHERE h.id LIKE 'hist_sit_%'
GROUP BY p.numero, p.id
ORDER BY COUNT(h.id) DESC
LIMIT 10;

-- ============================================================================
-- 8. AMOSTRA DOS HISTÓRICOS MIGRADOS
-- ============================================================================

SELECT 'AMOSTRA DOS HISTÓRICOS MIGRADOS (ÚLTIMOS 10):' as titulo;

SELECT
    p.numero as "Processo",
    h.titulo as "Título",
    h.descricao as "Descrição",
    h.tipo as "Tipo",
    h."createdAt"::DATE as "Data"
FROM "HistoricoProcesso" h
JOIN "Processo" p ON h."processoId" = p.id
WHERE h.id LIKE 'hist_sit_%'
ORDER BY h."createdAt" DESC
LIMIT 10;

-- ============================================================================
-- 9. VERIFICAÇÕES DE INTEGRIDADE
-- ============================================================================

SELECT 'VERIFICAÇÕES DE INTEGRIDADE:' as titulo;

-- Históricos sem processo
SELECT
    'Históricos sem processo correspondente' as verificacao,
    COUNT(*) as problemas
FROM "HistoricoProcesso" h
LEFT JOIN "Processo" p ON h."processoId" = p.id
WHERE h.id LIKE 'hist_sit_%' AND p.id IS NULL

UNION ALL SELECT
    'Históricos com descrição vazia' as verificacao,
    COUNT(*) as problemas
FROM "HistoricoProcesso" h
WHERE h.id LIKE 'hist_sit_%'
  AND (h.descricao IS NULL OR h.descricao = '')

UNION ALL SELECT
    'Históricos com título vazio' as verificacao,
    COUNT(*) as problemas
FROM "HistoricoProcesso" h
WHERE h.id LIKE 'hist_sit_%'
  AND (h.titulo IS NULL OR h.titulo = '');

-- ============================================================================
-- 10. RESULTADO FINAL
-- ============================================================================

SELECT
    'MIGRAÇÃO DE HISTÓRICOS CONCLUÍDA!' as "🎉 RESULTADO",
    'Banco: ' || current_database() as "📍 LOCAL",
    'IP: ' || inet_server_addr() as "🌐 SERVIDOR"

UNION ALL SELECT
    'Históricos totais: ' || COUNT(*)::TEXT as "🎉 RESULTADO",
    '' as "📍 LOCAL",
    '' as "🌐 SERVIDOR"
FROM "HistoricoProcesso"

UNION ALL SELECT
    'Históricos de Situations: ' || COUNT(*)::TEXT as "🎉 RESULTADO",
    '' as "📍 LOCAL",
    '' as "🌐 SERVIDOR"
FROM "HistoricoProcesso" WHERE id LIKE 'hist_sit_%';

-- ============================================================================
-- OBSERVAÇÕES FINAIS
-- ============================================================================

/*
ESTRUTURA DA MIGRAÇÃO:

1. Tabela origem: ccf."Situations" (banco sefin)
   - _id → usado para criar ID único
   - processId → mapeado para proc_X
   - title → título do histórico
   - situation → descrição do histórico
   - createdAt → data de criação

2. Tabela destino: "HistoricoProcesso" (banco ccf_db)
   - id: hist_sit_X (baseado no _id original)
   - processoId: proc_X (baseado no processId)
   - usuarioId: usuário de migração
   - titulo: title original
   - descricao: situation original
   - tipo: 'EVENTO'
   - createdAt: createdAt original

3. Benefícios:
   - Preserva histórico completo dos processos
   - Mantém cronologia original
   - Permite rastreabilidade
   - Integra com sistema de auditoria
*/