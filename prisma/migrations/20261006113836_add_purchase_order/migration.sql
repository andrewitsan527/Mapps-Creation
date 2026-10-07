-- CreateEnum
CREATE TYPE "CrDr" AS ENUM ('CR', 'DR');

-- CreateTable
CREATE TABLE "Knitter" (
    "id" TEXT NOT NULL,
    "knitterName" TEXT NOT NULL,
    "accountType" TEXT,
    "group" TEXT,
    "agent" TEXT,
    "gstin" TEXT,
    "compositeNo" TEXT,
    "ecoSgstin" TEXT,
    "registrationDate" TIMESTAMP(3),
    "receiverName" TEXT,
    "address" TEXT,
    "cityName" TEXT,
    "distance" DECIMAL(65,30),
    "phoneNo" TEXT,
    "mobileNo" TEXT,
    "faxNo" TEXT,
    "emailId" TEXT,
    "residentNo" TEXT,
    "address2" TEXT,
    "cityName2" TEXT,
    "manager" TEXT,
    "creditLimit" DECIMAL(65,30),
    "creditDays" INTEGER,
    "references" TEXT,
    "openingBalance" DECIMAL(65,30),
    "crDr" "CrDr",
    "tds" DECIMAL(65,30),
    "panNo" TEXT,
    "tanNo" TEXT,
    "kstNo" TEXT,
    "cstNo" TEXT,
    "gujaratState" TEXT,
    "tinNo" TEXT,
    "transName" TEXT,
    "discPercentage" DECIMAL(65,30),
    "rdPcs" DECIMAL(65,30),
    "mts" DECIMAL(65,30),
    "commPercentage" DECIMAL(65,30),
    "bankDetail" TEXT,
    "bankName" TEXT,
    "accountNo" TEXT,
    "ifscCode" TEXT,
    "branch" TEXT,
    "udyamRegNumber" TEXT,
    "enterpriseType" TEXT,
    "enterpriseActivity" TEXT,
    "tcsApplicable" BOOLEAN,
    "payment" TEXT,
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "masterType" TEXT NOT NULL DEFAULT 'KNITTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Knitter_pkey" PRIMARY KEY ("id")
);

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
