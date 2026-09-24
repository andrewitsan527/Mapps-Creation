-- QC can inspect a mill inward before a lot exists.
ALTER TABLE "QualityCheck" ALTER COLUMN "lotId" DROP NOT NULL;
ALTER TABLE "QualityCheck" ADD COLUMN "millInwardId" TEXT;
CREATE INDEX "QualityCheck_millInwardId_idx" ON "QualityCheck"("millInwardId");
ALTER TABLE "QualityCheck" DROP CONSTRAINT "QualityCheck_lotId_fkey";
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_millInwardId_fkey" FOREIGN KEY ("millInwardId") REFERENCES "MillInward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mill RF can point at a failed inward with no lot.
ALTER TABLE "MillReturn" ALTER COLUMN "lotId" DROP NOT NULL;
ALTER TABLE "MillReturn" ADD COLUMN "millInwardId" TEXT;
ALTER TABLE "MillReturn" DROP CONSTRAINT "MillReturn_lotId_fkey";
ALTER TABLE "MillReturn" ADD CONSTRAINT "MillReturn_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MillReturn" ADD CONSTRAINT "MillReturn_millInwardId_fkey" FOREIGN KEY ("millInwardId") REFERENCES "MillInward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
