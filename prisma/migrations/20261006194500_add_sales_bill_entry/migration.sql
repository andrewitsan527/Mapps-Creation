-- CreateTable
CREATE TABLE "SalesBillEntry" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "challanNo" TEXT NOT NULL DEFAULT '',
    "salesMasterId" TEXT,
    "hasteId" TEXT,
    "lrNo" TEXT NOT NULL DEFAULT '',
    "transportId" TEXT,
    "noOfParcel" TEXT NOT NULL DEFAULT '',
    "ewayNumber" TEXT NOT NULL DEFAULT '',
    "lrDate" TIMESTAMP(3),
    "destination" TEXT NOT NULL DEFAULT '',
    "paymentWithinDays" TEXT NOT NULL DEFAULT '',
    "discount" TEXT NOT NULL DEFAULT '',
    "addLessAmount" TEXT NOT NULL DEFAULT '',
    "freight" TEXT NOT NULL DEFAULT '',
    "cgstPct" DECIMAL(65,30) NOT NULL,
    "sgstPct" DECIMAL(65,30) NOT NULL,
    "cgstAmount" DECIMAL(65,30) NOT NULL,
    "sgstAmount" DECIMAL(65,30) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL,
    "freightAmount" DECIMAL(65,30) NOT NULL,
    "taxableAmount" DECIMAL(65,30) NOT NULL,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "totalRolls" DECIMAL(65,30) NOT NULL,
    "totalWeightKg" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesBillEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesBillEntryLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" TEXT,
    "colourCode" TEXT NOT NULL DEFAULT '',
    "hsn" TEXT NOT NULL DEFAULT '',
    "noOfRolls" TEXT NOT NULL DEFAULT '',
    "weightKg" DECIMAL(65,30) NOT NULL,
    "rate" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SalesBillEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesBillEntryRoll" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "weight" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SalesBillEntryRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesBillEntry_billNo_key" ON "SalesBillEntry"("billNo");

-- CreateIndex
CREATE INDEX "SalesBillEntry_salesMasterId_idx" ON "SalesBillEntry"("salesMasterId");

-- CreateIndex
CREATE INDEX "SalesBillEntry_hasteId_idx" ON "SalesBillEntry"("hasteId");

-- CreateIndex
CREATE INDEX "SalesBillEntry_transportId_idx" ON "SalesBillEntry"("transportId");

-- CreateIndex
CREATE INDEX "SalesBillEntry_billDate_idx" ON "SalesBillEntry"("billDate");

-- CreateIndex
CREATE INDEX "SalesBillEntryLine_billId_idx" ON "SalesBillEntryLine"("billId");

-- CreateIndex
CREATE INDEX "SalesBillEntryLine_itemId_idx" ON "SalesBillEntryLine"("itemId");

-- CreateIndex
CREATE INDEX "SalesBillEntryRoll_lineId_idx" ON "SalesBillEntryRoll"("lineId");

-- AddForeignKey
ALTER TABLE "SalesBillEntry" ADD CONSTRAINT "SalesBillEntry_salesMasterId_fkey" FOREIGN KEY ("salesMasterId") REFERENCES "SalesMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillEntry" ADD CONSTRAINT "SalesBillEntry_hasteId_fkey" FOREIGN KEY ("hasteId") REFERENCES "Haste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillEntry" ADD CONSTRAINT "SalesBillEntry_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillEntryLine" ADD CONSTRAINT "SalesBillEntryLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SalesBillEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillEntryLine" ADD CONSTRAINT "SalesBillEntryLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillEntryRoll" ADD CONSTRAINT "SalesBillEntryRoll_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "SalesBillEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
