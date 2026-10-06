-- AlterTable
ALTER TABLE "MillInwardEntry" ADD COLUMN     "qualityCheckId" TEXT,
ADD COLUMN     "returnChallanNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnColour" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnDefectType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnFailedRolls" INTEGER,
ADD COLUMN     "returnFinishedWorkSrNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnGrade" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnItemName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnKnitterChallanNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnProgramSrNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnQcSrNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sendNote" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "QualityCheckEntry" (
    "id" TEXT NOT NULL,
    "srNo" TEXT NOT NULL,
    "qcDate" TIMESTAMP(3) NOT NULL,
    "finishedWorkId" TEXT NOT NULL,
    "millProgramEntryId" TEXT NOT NULL,
    "knitterChallanNo" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT '',
    "defectType" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityCheckEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityCheckEntryLine" (
    "id" TEXT NOT NULL,
    "qcId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "rolls" INTEGER NOT NULL,
    "codeNo" TEXT NOT NULL DEFAULT '',
    "colour" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "QualityCheckEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillInwardEntryReturnLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "rolls" INTEGER NOT NULL,
    "codeNo" TEXT NOT NULL DEFAULT '',
    "colour" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MillInwardEntryReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualityCheckEntry_srNo_key" ON "QualityCheckEntry"("srNo");

-- CreateIndex
CREATE INDEX "QualityCheckEntry_finishedWorkId_idx" ON "QualityCheckEntry"("finishedWorkId");

-- CreateIndex
CREATE INDEX "QualityCheckEntry_millProgramEntryId_idx" ON "QualityCheckEntry"("millProgramEntryId");

-- CreateIndex
CREATE INDEX "QualityCheckEntryLine_qcId_idx" ON "QualityCheckEntryLine"("qcId");

-- CreateIndex
CREATE INDEX "MillInwardEntryReturnLine_entryId_idx" ON "MillInwardEntryReturnLine"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "MillInwardEntry_qualityCheckId_key" ON "MillInwardEntry"("qualityCheckId");

-- AddForeignKey
ALTER TABLE "MillInwardEntry" ADD CONSTRAINT "MillInwardEntry_qualityCheckId_fkey" FOREIGN KEY ("qualityCheckId") REFERENCES "QualityCheckEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheckEntry" ADD CONSTRAINT "QualityCheckEntry_finishedWorkId_fkey" FOREIGN KEY ("finishedWorkId") REFERENCES "FinishedWorkEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheckEntry" ADD CONSTRAINT "QualityCheckEntry_millProgramEntryId_fkey" FOREIGN KEY ("millProgramEntryId") REFERENCES "MillProgramEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheckEntryLine" ADD CONSTRAINT "QualityCheckEntryLine_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "QualityCheckEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillInwardEntryReturnLine" ADD CONSTRAINT "MillInwardEntryReturnLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MillInwardEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
