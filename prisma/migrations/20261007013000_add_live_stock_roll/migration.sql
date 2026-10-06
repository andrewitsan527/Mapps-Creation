-- CreateTable
CREATE TABLE "LiveStockRoll" (
    "id" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualityCheckEntryId" TEXT NOT NULL,

    CONSTRAINT "LiveStockRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveStockRoll_status_idx" ON "LiveStockRoll"("status");

-- CreateIndex
CREATE INDEX "LiveStockRoll_qualityCheckEntryId_idx" ON "LiveStockRoll"("qualityCheckEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStockRoll_qualityCheckEntryId_rollNo_key" ON "LiveStockRoll"("qualityCheckEntryId", "rollNo");

-- AddForeignKey
ALTER TABLE "LiveStockRoll" ADD CONSTRAINT "LiveStockRoll_qualityCheckEntryId_fkey" FOREIGN KEY ("qualityCheckEntryId") REFERENCES "QualityCheckEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
