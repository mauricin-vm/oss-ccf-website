/*
  Warnings:

  - You are about to drop the column `valorPago` on the `Parcela` table. All the data in the column will be lost.
  - Added the required column `dataVencimento` to the `Acordo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modalidadePagamento` to the `Acordo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valorFinal` to the `Acordo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Acordo" ADD COLUMN     "clausulasEspeciais" TEXT,
ADD COLUMN     "dataVencimento" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "modalidadePagamento" TEXT NOT NULL,
ADD COLUMN     "percentualDesconto" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ativo',
ADD COLUMN     "valorDesconto" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorFinal" DECIMAL(15,2) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Parcela" DROP COLUMN "valorPago";

-- CreateTable
CREATE TABLE "public"."PagamentoParcela" (
    "id" TEXT NOT NULL,
    "parcelaId" TEXT NOT NULL,
    "valorPago" DECIMAL(15,2) NOT NULL,
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "numeroComprovante" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagamentoParcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagamentoParcela_parcelaId_idx" ON "public"."PagamentoParcela"("parcelaId");

-- CreateIndex
CREATE INDEX "PagamentoParcela_dataPagamento_idx" ON "public"."PagamentoParcela"("dataPagamento");

-- AddForeignKey
ALTER TABLE "public"."PagamentoParcela" ADD CONSTRAINT "PagamentoParcela_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "public"."Parcela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
