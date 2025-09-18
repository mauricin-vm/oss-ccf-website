-- ============================================================================
-- MIGRAÇÃO FINAL - EXECUTAR NO BANCO ccf_db REMOTO (10.20.5.196)
-- ============================================================================
-- IMPORTANTE: Execute este script conectado ao banco ccf_db no servidor 10.20.5.196
-- NÃO execute no banco local!
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE ESTÁ NO BANCO CORRETO
-- ============================================================================

SELECT
    'VERIFICAÇÃO DE CONEXÃO' as titulo,
    current_database() as banco_atual,
    inet_server_addr() as ip_servidor;

-- Se o IP não for 10.20.5.196, PARE e conecte ao banco correto!

-- ============================================================================
-- 2. PREPARAÇÃO
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS dblink;

-- Função de mapeamento
CREATE OR REPLACE FUNCTION mapear_tipo_processo_ccf(tipo_antigo VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    CASE
        WHEN UPPER(COALESCE(tipo_antigo, '')) IN ('COMPENSACAO', 'COMPENSAÇÃO', 'COMP') THEN RETURN 'COMPENSACAO';
        WHEN UPPER(COALESCE(tipo_antigo, '')) IN ('DACAO', 'DAÇÃO', 'DACAO_PAGAMENTO', 'DACAO EM PAGAMENTO', 'DAÇÃO EM PAGAMENTO') THEN RETURN 'DACAO_PAGAMENTO';
        WHEN UPPER(COALESCE(tipo_antigo, '')) IN ('TRANSACAO', 'TRANSAÇÃO', 'TRANS_EXCEPCIONAL', 'TRANSACAO_EXCEPCIONAL', 'PARECER') THEN RETURN 'TRANSACAO_EXCEPCIONAL';
        ELSE RETURN 'COMPENSACAO';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CRIAR USUÁRIO DE MIGRAÇÃO
-- ============================================================================

INSERT INTO "User" (id, email, name, password, role, active, "createdAt", "updatedAt")
VALUES ('migracao_ccf_user', 'migracao_ccf@gov.br', 'Usuário de Migração CCF',
        '$2a$10$migracao.hash.ccf.system', 'ADMIN', false, now(), now())
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 4. LIMPAR DADOS ANTIGOS (SE EXISTIREM)
-- ============================================================================

DELETE FROM "LogAuditoria" WHERE id LIKE 'log_mig_%';
DELETE FROM "HistoricoProcesso" WHERE id LIKE 'hist_mig_%';
DELETE FROM "Processo" WHERE id LIKE 'proc_%';
DELETE FROM "Contribuinte" WHERE id LIKE 'contrib_%';

-- ============================================================================
-- 5. MIGRAR CONTRIBUINTES
-- ============================================================================

INSERT INTO "Contribuinte" (
    id, nome, "cpfCnpj", email, telefone, "createdAt", "updatedAt"
)
SELECT
    'contrib_' || dados.id_processo AS id,
    dados.nome_contribuinte AS nome,
    CASE
        WHEN dados.cpf_cnpj IS NULL OR dados.cpf_cnpj = '' THEN NULL
        ELSE REGEXP_REPLACE(dados.cpf_cnpj, '[^0-9]', '', 'g')
    END AS "cpfCnpj",
    CASE
        WHEN dados.email_contato IS NULL OR TRIM(dados.email_contato) = '' THEN NULL
        ELSE TRIM(dados.email_contato)
    END AS email,
    CASE
        WHEN dados.telefone_contato IS NULL OR dados.telefone_contato = '' THEN NULL
        ELSE REGEXP_REPLACE(dados.telefone_contato, '[^0-9]', '', 'g')
    END AS telefone,
    dados.data_criacao AS "createdAt",
    now() AS "updatedAt"
FROM dblink(
    'host=10.20.5.196 port=5432 dbname=sefin user=postgres password=admin',
    '
    SELECT
        p._id::INTEGER as id_processo,
        p.fullname::VARCHAR as nome_contribuinte,
        COALESCE(p."cpfCnpj", '''')::VARCHAR as cpf_cnpj,
        COALESCE((SELECT contact FROM ccf."Contacts" WHERE "processId" = p._id AND type = ''email'' LIMIT 1), '''')::VARCHAR as email_contato,
        COALESCE((SELECT contact FROM ccf."Contacts" WHERE "processId" = p._id AND type = ''telefone'' LIMIT 1), '''')::VARCHAR as telefone_contato,
        p."createdAt"::TIMESTAMP as data_criacao
    FROM ccf."Processes" p
    WHERE p.fullname IS NOT NULL AND p.process IS NOT NULL
    '
) AS dados(id_processo INTEGER, nome_contribuinte VARCHAR, cpf_cnpj VARCHAR,
           email_contato VARCHAR, telefone_contato VARCHAR, data_criacao TIMESTAMP);

-- ============================================================================
-- 6. MIGRAR PROCESSOS
-- ============================================================================

INSERT INTO "Processo" (
    id, numero, tipo, status, "dataAbertura", "dataFinalizacao", observacoes,
    "contribuinteId", "createdById", "createdAt", "updatedAt"
)
SELECT
    'proc_' || dados.id_processo AS id,
    dados.numero_processo AS numero,
    mapear_tipo_processo_ccf(dados.tipo_processo)::"TipoProcesso" AS tipo,
    'RECEPCIONADO'::"StatusProcesso" AS status,
    dados.data_abertura AS "dataAbertura",
    CASE WHEN dados.processo_concluido THEN dados.data_atualizacao ELSE NULL END AS "dataFinalizacao",
    COALESCE(dados.observacoes, 'Processo migrado do sistema antigo') AS observacoes,
    'contrib_' || dados.id_processo AS "contribuinteId",
    'migracao_ccf_user' AS "createdById",
    dados.data_criacao AS "createdAt",
    now() AS "updatedAt"
FROM dblink(
    'host=10.20.5.196 port=5432 dbname=sefin user=postgres password=admin',
    '
    SELECT
        p._id::INTEGER as id_processo,
        p.process::VARCHAR as numero_processo,
        p.type::VARCHAR as tipo_processo,
        p."createdAt"::TIMESTAMP as data_abertura,
        p."updatedAt"::TIMESTAMP as data_atualizacao,
        p.concluded::BOOLEAN as processo_concluido,
        COALESCE(p.observation, '''')::TEXT as observacoes,
        p."createdAt"::TIMESTAMP as data_criacao
    FROM ccf."Processes" p
    WHERE p.fullname IS NOT NULL AND p.process IS NOT NULL
    '
) AS dados(id_processo INTEGER, numero_processo VARCHAR, tipo_processo VARCHAR,
           data_abertura TIMESTAMP, data_atualizacao TIMESTAMP, processo_concluido BOOLEAN,
           observacoes TEXT, data_criacao TIMESTAMP);

-- ============================================================================
-- 7. CRIAR HISTÓRICOS
-- ============================================================================

INSERT INTO "HistoricoProcesso" (id, "processoId", "usuarioId", titulo, descricao, tipo, "createdAt")
SELECT
    'hist_mig_' || p.id AS id,
    p.id AS "processoId",
    'migracao_ccf_user' AS "usuarioId",
    'Processo Migrado' AS titulo,
    'Processo migrado do sistema antigo CCF' AS descricao,
    'SISTEMA' AS tipo,
    p."createdAt" AS "createdAt"
FROM "Processo" p
WHERE p.id LIKE 'proc_%';

-- ============================================================================
-- 8. CRIAR LOGS DE AUDITORIA
-- ============================================================================

INSERT INTO "LogAuditoria" (id, "usuarioId", acao, entidade, "entidadeId", "dadosNovos", "createdAt")
SELECT
    'log_mig_' || p.id AS id,
    'migracao_ccf_user' AS "usuarioId",
    'MIGRATE' AS acao,
    'Processo' AS entidade,
    p.id AS "entidadeId",
    jsonb_build_object('numero', p.numero, 'tipo', p.tipo, 'status', 'RECEPCIONADO') AS "dadosNovos",
    now() AS "createdAt"
FROM "Processo" p
WHERE p.id LIKE 'proc_%';

-- ============================================================================
-- 9. RELATÓRIO FINAL
-- ============================================================================

SELECT
    'MIGRAÇÃO CONCLUÍDA NO BANCO REMOTO!' as "🎉 RESULTADO",
    'Banco: ' || current_database() as "📍 LOCAL",
    'IP: ' || inet_server_addr() as "🌐 SERVIDOR"

UNION ALL SELECT
    'Contribuintes migrados: ' || COUNT(*)::TEXT as "🎉 RESULTADO",
    '' as "📍 LOCAL",
    '' as "🌐 SERVIDOR"
FROM "Contribuinte" WHERE id LIKE 'contrib_%'

UNION ALL SELECT
    'Processos migrados: ' || COUNT(*)::TEXT as "🎉 RESULTADO",
    '' as "📍 LOCAL",
    '' as "🌐 SERVIDOR"
FROM "Processo" WHERE id LIKE 'proc_%'

UNION ALL SELECT
    'Históricos criados: ' || COUNT(*)::TEXT as "🎉 RESULTADO",
    '' as "📍 LOCAL",
    '' as "🌐 SERVIDOR"
FROM "HistoricoProcesso" WHERE id LIKE 'hist_mig_%'

UNION ALL SELECT
    'Logs criados: ' || COUNT(*)::TEXT as "🎉 RESULTADO",
    '' as "📍 LOCAL",
    '' as "🌐 SERVIDOR"
FROM "LogAuditoria" WHERE id LIKE 'log_mig_%';

-- ============================================================================
-- 10. LIMPEZA
-- ============================================================================

DROP FUNCTION IF EXISTS mapear_tipo_processo_ccf(VARCHAR);

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

SELECT 'VERIFICAÇÃO FINAL - DADOS NO BANCO REMOTO:' as titulo;

SELECT p.numero, p.tipo, c.nome, p."dataAbertura"::DATE
FROM "Processo" p
JOIN "Contribuinte" c ON p."contribuinteId" = c.id
WHERE p.id LIKE 'proc_%'
ORDER BY p."dataAbertura" DESC
LIMIT 5;