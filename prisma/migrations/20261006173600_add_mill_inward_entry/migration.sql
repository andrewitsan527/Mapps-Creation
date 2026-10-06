-- CreateTable
CREATE TABLE "MillInwardEntry" (
    "id" TEXT NOT NULL,
    "srNo" TEXT NOT NULL,
    "inwardDate" TIMESTAMP(3) NOT NULL,
    "dateOfIssue" TIMESTAMP(3),
    "knitterId" TEXT,
    "millId" TEXT,
    "quantityKg" DECIMAL(65,30),
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentOn" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "greyBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillInwardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillInwardEntryItem" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "itemId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "rolls" DECIMAL(65,30),
    "qtyKg" DECIMAL(65,30),

    CONSTRAINT "MillInwardEntryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillInwardEntryRoll" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "weightKg" DECIMAL(65,30),

    CONSTRAINT "MillInwardEntryRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MillInwardEntry_srNo_key" ON "MillInwardEntry"("srNo");

-- CreateIndex
CREATE UNIQUE INDEX "MillInwardEntry_greyBillId_key" ON "MillInwardEntry"("greyBillId");

-- CreateIndex
CREATE INDEX "MillInwardEntry_knitterId_idx" ON "MillInwardEntry"("knitterId");

-- CreateIndex
CREATE INDEX "MillInwardEntry_millId_idx" ON "MillInwardEntry"("millId");

-- CreateIndex
CREATE INDEX "MillInwardEntryItem_entryId_idx" ON "MillInwardEntryItem"("entryId");

-- CreateIndex
CREATE INDEX "MillInwardEntryItem_itemId_idx" ON "MillInwardEntryItem"("itemId");

-- CreateIndex
CREATE INDEX "MillInwardEntryRoll_entryId_idx" ON "MillInwardEntryRoll"("entryId");

-- AddForeignKey
ALTER TABLE "MillInwardEntry" ADD CONSTRAINT "MillInwardEntry_knitterId_fkey" FOREIGN KEY ("knitterId") REFERENCES "Knitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillInwardEntry" ADD CONSTRAINT "MillInwardEntry_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Mill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillInwardEntry" ADD CONSTRAINT "MillInwardEntry_greyBillId_fkey" FOREIGN KEY ("greyBillId") REFERENCES "GreyBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillInwardEntryItem" ADD CONSTRAINT "MillInwardEntryItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MillInwardEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillInwardEntryItem" ADD CONSTRAINT "MillInwardEntryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillInwardEntryRoll" ADD CONSTRAINT "MillInwardEntryRoll_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MillInwardEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
