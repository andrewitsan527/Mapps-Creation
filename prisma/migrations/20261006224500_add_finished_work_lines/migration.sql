-- CreateTable
CREATE TABLE "FinishedWorkEntryLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemId" TEXT,
    "lotNo" TEXT NOT NULL DEFAULT '',
    "rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rolls" INTEGER NOT NULL DEFAULT 0,
    "greyKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "finishedKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "FinishedWorkEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedWorkEntryRoll" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "greyKg" DECIMAL(65,30) NOT NULL,
    "finishedKg" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "FinishedWorkEntryRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinishedWorkEntryLine_entryId_idx" ON "FinishedWorkEntryLine"("entryId");

-- CreateIndex
CREATE INDEX "FinishedWorkEntryLine_itemId_idx" ON "FinishedWorkEntryLine"("itemId");

-- CreateIndex
CREATE INDEX "FinishedWorkEntryRoll_lineId_idx" ON "FinishedWorkEntryRoll"("lineId");

-- AddForeignKey
ALTER TABLE "FinishedWorkEntryLine" ADD CONSTRAINT "FinishedWorkEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinishedWorkEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedWorkEntryLine" ADD CONSTRAINT "FinishedWorkEntryLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedWorkEntryRoll" ADD CONSTRAINT "FinishedWorkEntryRoll_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "FinishedWorkEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
