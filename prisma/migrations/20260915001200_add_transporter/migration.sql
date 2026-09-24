-- AlterEnum
ALTER TYPE "PartyType" ADD VALUE 'TRANSPORTER';

-- AlterTable
ALTER TABLE "SaleBill" ADD COLUMN "transporterId" TEXT;

-- CreateIndex
CREATE INDEX "SaleBill_transporterId_idx" ON "SaleBill"("transporterId");

-- AddForeignKey
ALTER TABLE "SaleBill" ADD CONSTRAINT "SaleBill_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
