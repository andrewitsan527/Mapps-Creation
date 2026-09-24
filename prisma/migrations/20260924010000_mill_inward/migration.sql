-- Partial mill receipts against a program (before QC / lot).
CREATE TABLE "MillInward" (
    "id" TEXT NOT NULL,
    "inwardNo" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "inwardDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'm',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillInward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MillInward_inwardNo_key" ON "MillInward"("inwardNo");
CREATE INDEX "MillInward_programId_inwardDate_idx" ON "MillInward"("programId", "inwardDate");

ALTER TABLE "MillInward" ADD CONSTRAINT "MillInward_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MillProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lot" ADD COLUMN "millInwardId" TEXT;
CREATE UNIQUE INDEX "Lot_millInwardId_key" ON "Lot"("millInwardId");
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_millInwardId_fkey" FOREIGN KEY ("millInwardId") REFERENCES "MillInward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
