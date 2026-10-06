-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "srNo" TEXT NOT NULL,
    "knitterId" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "qtyUnits" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "agent" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_srNo_key" ON "PurchaseOrder"("srNo");

-- CreateIndex
CREATE INDEX "PurchaseOrder_knitterId_idx" ON "PurchaseOrder"("knitterId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_knitterId_fkey" FOREIGN KEY ("knitterId") REFERENCES "Knitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
