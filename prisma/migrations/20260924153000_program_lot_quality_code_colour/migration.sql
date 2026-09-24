-- AlterTable
ALTER TABLE "MillProgram" ALTER COLUMN "shadeId" DROP NOT NULL,
ADD COLUMN     "qualityId" TEXT,
ADD COLUMN     "codeId" TEXT,
ADD COLUMN     "colourId" TEXT;

-- AlterTable
ALTER TABLE "Lot" ALTER COLUMN "shadeId" DROP NOT NULL,
ADD COLUMN     "qualityId" TEXT,
ADD COLUMN     "codeId" TEXT,
ADD COLUMN     "colourId" TEXT;

-- CreateIndex
CREATE INDEX "MillProgram_qualityId_codeId_colourId_idx" ON "MillProgram"("qualityId", "codeId", "colourId");

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_qualityId_fkey" FOREIGN KEY ("qualityId") REFERENCES "Quality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "Code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_qualityId_fkey" FOREIGN KEY ("qualityId") REFERENCES "Quality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "Code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
