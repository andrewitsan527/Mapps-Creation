-- CreateTable
CREATE TABLE "GreyBill" (
    "id" TEXT NOT NULL,
    "srNo" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "billNo" TEXT NOT NULL DEFAULT '',
    "challanNo" TEXT NOT NULL DEFAULT '',
    "knitterId" TEXT,
    "millId" TEXT,
    "agent" TEXT,
    "remarks" TEXT,
    "freightRate" DECIMAL(65,30),
    "goodsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "freightAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SAVED',
    "purchaseOrderId" TEXT,
    "matchScore" INTEGER,
    "matchStatus" TEXT,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreyBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreyBillItem" (
    "id" TEXT NOT NULL,
    "greyBillId" TEXT NOT NULL,
    "itemId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "rolls" DECIMAL(65,30),
    "qtyKg" DECIMAL(65,30),
    "rate" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "GreyBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreyBillRoll" (
    "id" TEXT NOT NULL,
    "greyBillId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "weightKg" DECIMAL(65,30),

    CONSTRAINT "GreyBillRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GreyBill_srNo_key" ON "GreyBill"("srNo");

-- CreateIndex
CREATE INDEX "GreyBill_knitterId_idx" ON "GreyBill"("knitterId");

-- CreateIndex
CREATE INDEX "GreyBill_millId_idx" ON "GreyBill"("millId");

-- CreateIndex
CREATE INDEX "GreyBill_purchaseOrderId_idx" ON "GreyBill"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GreyBillItem_greyBillId_idx" ON "GreyBillItem"("greyBillId");

-- CreateIndex
CREATE INDEX "GreyBillItem_itemId_idx" ON "GreyBillItem"("itemId");

-- CreateIndex
CREATE INDEX "GreyBillRoll_greyBillId_idx" ON "GreyBillRoll"("greyBillId");

-- AddForeignKey
ALTER TABLE "GreyBill" ADD CONSTRAINT "GreyBill_knitterId_fkey" FOREIGN KEY ("knitterId") REFERENCES "Knitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyBill" ADD CONSTRAINT "GreyBill_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Mill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyBill" ADD CONSTRAINT "GreyBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyBillItem" ADD CONSTRAINT "GreyBillItem_greyBillId_fkey" FOREIGN KEY ("greyBillId") REFERENCES "GreyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyBillItem" ADD CONSTRAINT "GreyBillItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyBillRoll" ADD CONSTRAINT "GreyBillRoll_greyBillId_fkey" FOREIGN KEY ("greyBillId") REFERENCES "GreyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
