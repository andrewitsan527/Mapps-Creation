-- Mill-specific weavers (many-to-many). Existing Party IDs are unchanged.
CREATE TABLE "MillWeaver" (
    "id" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "weaverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MillWeaver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MillWeaver_millId_weaverId_key" ON "MillWeaver"("millId", "weaverId");
CREATE INDEX "MillWeaver_weaverId_idx" ON "MillWeaver"("weaverId");

ALTER TABLE "MillWeaver" ADD CONSTRAINT "MillWeaver_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MillWeaver" ADD CONSTRAINT "MillWeaver_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Destination mill / grey agent / dyeing rate on Grey PO.
-- millId is nullable so existing Grey Purchase rows stay valid without backfill.
ALTER TABLE "GreyPurchaseOrder" ADD COLUMN "millId" TEXT;
ALTER TABLE "GreyPurchaseOrder" ADD COLUMN "agentId" TEXT;
ALTER TABLE "GreyPurchaseOrder" ADD COLUMN "dyeingRate" DECIMAL(65,30);

ALTER TABLE "GreyPurchaseOrder" ADD CONSTRAINT "GreyPurchaseOrder_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GreyPurchaseOrder" ADD CONSTRAINT "GreyPurchaseOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GreyPurchaseOrder_millId_idx" ON "GreyPurchaseOrder"("millId");
CREATE INDEX "GreyPurchaseOrder_agentId_idx" ON "GreyPurchaseOrder"("agentId");
