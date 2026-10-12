-- AlterTable
ALTER TABLE "SalesBillEntryRoll" ADD COLUMN "liveStockRollId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SalesBillEntryRoll_liveStockRollId_key" ON "SalesBillEntryRoll"("liveStockRollId");

-- AddForeignKey
ALTER TABLE "SalesBillEntryRoll" ADD CONSTRAINT "SalesBillEntryRoll_liveStockRollId_fkey" FOREIGN KEY ("liveStockRollId") REFERENCES "LiveStockRoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
