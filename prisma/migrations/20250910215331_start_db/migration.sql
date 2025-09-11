-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'FUNCIONARIO', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "public"."TipoProcesso" AS ENUM ('COMPENSACAO', 'DACAO_PAGAMENTO', 'TRANSACAO_EXCEPCIONAL');

-- CreateEnum
CREATE TYPE "public"."StatusProcesso" AS ENUM ('RECEPCIONADO', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTOS', 'EM_PAUTA', 'JULGADO', 'ACORDO_FIRMADO', 'EM_CUMPRIMENTO', 'FINALIZADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "public"."StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'FUNCIONARIO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contribuinte" (
    "id" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribuinte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Processo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "public"."TipoProcesso" NOT NULL,
    "status" "public"."StatusProcesso" NOT NULL DEFAULT 'RECEPCIONADO',
    "valorOriginal" DECIMAL(15,2) NOT NULL,
    "valorNegociado" DECIMAL(15,2),
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFinalizacao" TIMESTAMP(3),
    "observacoes" TEXT,
    "contribuinteId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Imovel" (
    "id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "valorAvaliado" DECIMAL(15,2) NOT NULL,
    "descricao" TEXT,
    "proprietarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Imovel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessoImovel" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "imovelId" TEXT NOT NULL,
    "tipoRelacao" TEXT NOT NULL,

    CONSTRAINT "ProcessoImovel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Credito" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "dataVencimento" TIMESTAMP(3),
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessoCredito" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "valorUtilizado" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "ProcessoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tramitacao" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "setorOrigem" TEXT NOT NULL,
    "setorDestino" TEXT NOT NULL,
    "dataEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRecebimento" TIMESTAMP(3),
    "prazoResposta" TIMESTAMP(3),
    "observacoes" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tramitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Documento" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pauta" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dataPauta" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pauta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessoPauta" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "pautaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "relator" TEXT,

    CONSTRAINT "ProcessoPauta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessaoJulgamento" (
    "id" TEXT NOT NULL,
    "pautaId" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "ata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessaoJulgamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Decisao" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "sessaoId" TEXT,
    "tipo" TEXT NOT NULL,
    "fundamentacao" TEXT NOT NULL,
    "dataDecisao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroAcordao" TEXT,
    "dataPublicacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Acordo" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "numeroTermo" TEXT NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(15,2) NOT NULL,
    "numeroParcelas" INTEGER NOT NULL,
    "valorEntrada" DECIMAL(15,2),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acordo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Parcela" (
    "id" TEXT NOT NULL,
    "acordoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "valorPago" DECIMAL(15,2),
    "status" "public"."StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "email" TEXT,
    "responsavel" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_Conselheiro" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Conselheiro_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contribuinte_cpfCnpj_key" ON "public"."Contribuinte"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Processo_numero_key" ON "public"."Processo"("numero");

-- CreateIndex
CREATE INDEX "Processo_contribuinteId_idx" ON "public"."Processo"("contribuinteId");

-- CreateIndex
CREATE INDEX "Processo_status_idx" ON "public"."Processo"("status");

-- CreateIndex
CREATE INDEX "Processo_tipo_idx" ON "public"."Processo"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Imovel_matricula_key" ON "public"."Imovel"("matricula");

-- CreateIndex
CREATE INDEX "Imovel_proprietarioId_idx" ON "public"."Imovel"("proprietarioId");

-- CreateIndex
CREATE INDEX "ProcessoImovel_processoId_idx" ON "public"."ProcessoImovel"("processoId");

-- CreateIndex
CREATE INDEX "ProcessoImovel_imovelId_idx" ON "public"."ProcessoImovel"("imovelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessoImovel_processoId_imovelId_key" ON "public"."ProcessoImovel"("processoId", "imovelId");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_numero_key" ON "public"."Credito"("numero");

-- CreateIndex
CREATE INDEX "ProcessoCredito_processoId_idx" ON "public"."ProcessoCredito"("processoId");

-- CreateIndex
CREATE INDEX "ProcessoCredito_creditoId_idx" ON "public"."ProcessoCredito"("creditoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessoCredito_processoId_creditoId_key" ON "public"."ProcessoCredito"("processoId", "creditoId");

-- CreateIndex
CREATE INDEX "Tramitacao_processoId_idx" ON "public"."Tramitacao"("processoId");

-- CreateIndex
CREATE INDEX "Tramitacao_usuarioId_idx" ON "public"."Tramitacao"("usuarioId");

-- CreateIndex
CREATE INDEX "Documento_processoId_idx" ON "public"."Documento"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "Pauta_numero_key" ON "public"."Pauta"("numero");

-- CreateIndex
CREATE INDEX "ProcessoPauta_processoId_idx" ON "public"."ProcessoPauta"("processoId");

-- CreateIndex
CREATE INDEX "ProcessoPauta_pautaId_idx" ON "public"."ProcessoPauta"("pautaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessoPauta_processoId_pautaId_key" ON "public"."ProcessoPauta"("processoId", "pautaId");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoJulgamento_pautaId_key" ON "public"."SessaoJulgamento"("pautaId");

-- CreateIndex
CREATE UNIQUE INDEX "Decisao_numeroAcordao_key" ON "public"."Decisao"("numeroAcordao");

-- CreateIndex
CREATE INDEX "Decisao_processoId_idx" ON "public"."Decisao"("processoId");

-- CreateIndex
CREATE INDEX "Decisao_sessaoId_idx" ON "public"."Decisao"("sessaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Acordo_processoId_key" ON "public"."Acordo"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "Acordo_numeroTermo_key" ON "public"."Acordo"("numeroTermo");

-- CreateIndex
CREATE INDEX "Parcela_acordoId_idx" ON "public"."Parcela"("acordoId");

-- CreateIndex
CREATE INDEX "Parcela_status_idx" ON "public"."Parcela"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "public"."Setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Setor_sigla_key" ON "public"."Setor"("sigla");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "public"."LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "public"."LogAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "_Conselheiro_B_index" ON "public"."_Conselheiro"("B");

-- AddForeignKey
ALTER TABLE "public"."Processo" ADD CONSTRAINT "Processo_contribuinteId_fkey" FOREIGN KEY ("contribuinteId") REFERENCES "public"."Contribuinte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Processo" ADD CONSTRAINT "Processo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Imovel" ADD CONSTRAINT "Imovel_proprietarioId_fkey" FOREIGN KEY ("proprietarioId") REFERENCES "public"."Contribuinte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProcessoImovel" ADD CONSTRAINT "ProcessoImovel_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProcessoImovel" ADD CONSTRAINT "ProcessoImovel_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "public"."Imovel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProcessoCredito" ADD CONSTRAINT "ProcessoCredito_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProcessoCredito" ADD CONSTRAINT "ProcessoCredito_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "public"."Credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tramitacao" ADD CONSTRAINT "Tramitacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tramitacao" ADD CONSTRAINT "Tramitacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Documento" ADD CONSTRAINT "Documento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProcessoPauta" ADD CONSTRAINT "ProcessoPauta_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProcessoPauta" ADD CONSTRAINT "ProcessoPauta_pautaId_fkey" FOREIGN KEY ("pautaId") REFERENCES "public"."Pauta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessaoJulgamento" ADD CONSTRAINT "SessaoJulgamento_pautaId_fkey" FOREIGN KEY ("pautaId") REFERENCES "public"."Pauta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Decisao" ADD CONSTRAINT "Decisao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Decisao" ADD CONSTRAINT "Decisao_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "public"."SessaoJulgamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Acordo" ADD CONSTRAINT "Acordo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Parcela" ADD CONSTRAINT "Parcela_acordoId_fkey" FOREIGN KEY ("acordoId") REFERENCES "public"."Acordo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_Conselheiro" ADD CONSTRAINT "_Conselheiro_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."SessaoJulgamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_Conselheiro" ADD CONSTRAINT "_Conselheiro_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
