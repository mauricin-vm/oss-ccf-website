-- CreateTable
CREATE TABLE "public"."HistoricoProcesso" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'EVENTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoProcesso_processoId_idx" ON "public"."HistoricoProcesso"("processoId");

-- CreateIndex
CREATE INDEX "HistoricoProcesso_usuarioId_idx" ON "public"."HistoricoProcesso"("usuarioId");

-- CreateIndex
CREATE INDEX "HistoricoProcesso_createdAt_idx" ON "public"."HistoricoProcesso"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."HistoricoProcesso" ADD CONSTRAINT "HistoricoProcesso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "public"."Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HistoricoProcesso" ADD CONSTRAINT "HistoricoProcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
