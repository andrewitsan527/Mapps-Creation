-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_shadeId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_shadeId_fkey";

-- DropIndex
DROP INDEX "MillProgram_shadeId_fabricTypeId_idx";

-- DropIndex
DROP INDEX "Lot_fabricTypeId_shadeId_idx";

-- AlterTable
ALTER TABLE "MillProgram" DROP COLUMN "shadeId";

-- AlterTable
ALTER TABLE "Lot" DROP COLUMN "shadeId";

-- AlterTable
ALTER TABLE "SaleBillLine" DROP COLUMN "colorFamily",
DROP COLUMN "shadeName",
DROP COLUMN "shadeCode";

-- CreateIndex
CREATE INDEX "Lot_fabricTypeId_idx" ON "Lot"("fabricTypeId");

-- DropTable
DROP TABLE "Shade";

-- DropTable
DROP TABLE "ColorFamily";
