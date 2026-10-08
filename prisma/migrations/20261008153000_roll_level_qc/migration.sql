-- Roll-level QC. Existing rows keep their data. New columns are nullable or defaulted.

ALTER TABLE "QualityCheckEntry" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'submitted';

ALTER TABLE "QualityCheckEntryLine" ADD COLUMN "decision" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QualityCheckEntryLine" ADD COLUMN "finishedWorkEntryRollId" TEXT;

ALTER TABLE "LiveStockRoll" ADD COLUMN "qualityState" TEXT NOT NULL DEFAULT 'PASSED';
ALTER TABLE "LiveStockRoll" ADD COLUMN "finishedWorkEntryRollId" TEXT;

ALTER TABLE "MillInwardEntryReturnLine" ADD COLUMN "finishedKg" DECIMAL(65,30);
ALTER TABLE "MillInwardEntryReturnLine" ADD COLUMN "finishedWorkEntryRollId" TEXT;

CREATE INDEX "QualityCheckEntry_status_idx" ON "QualityCheckEntry"("status");
CREATE INDEX "QualityCheckEntryLine_finishedWorkEntryRollId_idx" ON "QualityCheckEntryLine"("finishedWorkEntryRollId");
CREATE UNIQUE INDEX "LiveStockRoll_finishedWorkEntryRollId_key" ON "LiveStockRoll"("finishedWorkEntryRollId");
CREATE INDEX "MillInwardEntryReturnLine_finishedWorkEntryRollId_idx" ON "MillInwardEntryReturnLine"("finishedWorkEntryRollId");

ALTER TABLE "QualityCheckEntryLine" ADD CONSTRAINT "QualityCheckEntryLine_finishedWorkEntryRollId_fkey" FOREIGN KEY ("finishedWorkEntryRollId") REFERENCES "FinishedWorkEntryRoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveStockRoll" ADD CONSTRAINT "LiveStockRoll_finishedWorkEntryRollId_fkey" FOREIGN KEY ("finishedWorkEntryRollId") REFERENCES "FinishedWorkEntryRoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MillInwardEntryReturnLine" ADD CONSTRAINT "MillInwardEntryReturnLine_finishedWorkEntryRollId_fkey" FOREIGN KEY ("finishedWorkEntryRollId") REFERENCES "FinishedWorkEntryRoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
