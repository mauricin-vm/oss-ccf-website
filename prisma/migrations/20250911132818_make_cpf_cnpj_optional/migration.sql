-- DropIndex
DROP INDEX "public"."Contribuinte_cpfCnpj_key";

-- AlterTable
ALTER TABLE "public"."Contribuinte" ALTER COLUMN "cpfCnpj" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Contribuinte_cpfCnpj_idx" ON "public"."Contribuinte"("cpfCnpj");
