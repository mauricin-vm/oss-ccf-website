/*
  Warnings:

  - You are about to drop the column `especialidade` on the `Conselheiro` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Conselheiro" DROP COLUMN "especialidade",
ADD COLUMN     "origem" TEXT;
