-- AlterTable
ALTER TABLE "FinishedWorkEntry" ADD COLUMN     "millId" TEXT,
ALTER COLUMN "millProgramEntryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FinishedWorkEntry_millId_idx" ON "FinishedWorkEntry"("millId");

-- AddForeignKey
ALTER TABLE "FinishedWorkEntry" ADD CONSTRAINT "FinishedWorkEntry_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Mill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
