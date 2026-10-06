-- CreateTable
CREATE TABLE "FinishedWorkEntry" (
    "id" TEXT NOT NULL,
    "srNo" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "millProgramEntryId" TEXT NOT NULL,
    "gpNo" TEXT NOT NULL DEFAULT '',
    "knitterChallanNo" TEXT NOT NULL DEFAULT '',
    "challanNo" TEXT NOT NULL DEFAULT '',
    "lotNo" TEXT NOT NULL DEFAULT '',
    "rolls" INTEGER NOT NULL,
    "greyKg" DECIMAL(65,30) NOT NULL,
    "finishedKg" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "shortageKg" DECIMAL(65,30) NOT NULL,
    "shortagePct" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishedWorkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinishedWorkEntry_srNo_key" ON "FinishedWorkEntry"("srNo");

-- CreateIndex
CREATE INDEX "FinishedWorkEntry_millProgramEntryId_idx" ON "FinishedWorkEntry"("millProgramEntryId");

-- AddForeignKey
ALTER TABLE "FinishedWorkEntry" ADD CONSTRAINT "FinishedWorkEntry_millProgramEntryId_fkey" FOREIGN KEY ("millProgramEntryId") REFERENCES "MillProgramEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
