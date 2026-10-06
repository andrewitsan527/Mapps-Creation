-- CreateEnum
CREATE TYPE "CrDr" AS ENUM ('CR', 'DR');

-- DropForeignKey
ALTER TABLE "AccountNote" DROP CONSTRAINT "AccountNote_partyId_fkey";

-- DropForeignKey
ALTER TABLE "AgentLink" DROP CONSTRAINT "AgentLink_agentId_fkey";

-- DropForeignKey
ALTER TABLE "AgentLink" DROP CONSTRAINT "AgentLink_relatedPartyId_fkey";

-- DropForeignKey
ALTER TABLE "CommissionEntry" DROP CONSTRAINT "CommissionEntry_agentId_fkey";

-- DropForeignKey
ALTER TABLE "CommissionEntry" DROP CONSTRAINT "CommissionEntry_relatedPartyId_fkey";

-- DropForeignKey
ALTER TABLE "Dispatch" DROP CONSTRAINT "Dispatch_partyId_fkey";

-- DropForeignKey
ALTER TABLE "GodownLocation" DROP CONSTRAINT "GodownLocation_godownId_fkey";

-- DropForeignKey
ALTER TABLE "GreyPurchaseOrder" DROP CONSTRAINT "GreyPurchaseOrder_agentId_fkey";

-- DropForeignKey
ALTER TABLE "GreyPurchaseOrder" DROP CONSTRAINT "GreyPurchaseOrder_millId_fkey";

-- DropForeignKey
ALTER TABLE "GreyPurchaseOrder" DROP CONSTRAINT "GreyPurchaseOrder_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_codeId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_colourId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_fabricTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_finishTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_godownId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_millId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_millMarkaId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_qualityId_fkey";

-- DropForeignKey
ALTER TABLE "Lot" DROP CONSTRAINT "Lot_weaverId_fkey";

-- DropForeignKey
ALTER TABLE "MillMarka" DROP CONSTRAINT "MillMarka_millId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_codeId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_colourId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_fabricTypeId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_finishTypeId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_millId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_qualityId_fkey";

-- DropForeignKey
ALTER TABLE "MillProgram" DROP CONSTRAINT "MillProgram_weaverId_fkey";

-- DropForeignKey
ALTER TABLE "MillReturn" DROP CONSTRAINT "MillReturn_millId_fkey";

-- DropForeignKey
ALTER TABLE "MillWeaver" DROP CONSTRAINT "MillWeaver_millId_fkey";

-- DropForeignKey
ALTER TABLE "MillWeaver" DROP CONSTRAINT "MillWeaver_weaverId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_partyId_fkey";

-- DropForeignKey
ALTER TABLE "SaleBill" DROP CONSTRAINT "SaleBill_partyId_fkey";

-- DropForeignKey
ALTER TABLE "SaleBill" DROP CONSTRAINT "SaleBill_transporterId_fkey";

-- DropForeignKey
ALTER TABLE "SalesReturn" DROP CONSTRAINT "SalesReturn_millMarkaId_fkey";

-- DropForeignKey
ALTER TABLE "SalesReturn" DROP CONSTRAINT "SalesReturn_partyId_fkey";

-- DropIndex
DROP INDEX "AccountNote_partyId_type_idx";

-- DropIndex
DROP INDEX "CommissionEntry_agentId_createdAt_idx";

-- DropIndex
DROP INDEX "Dispatch_partyId_status_idx";

-- DropIndex
DROP INDEX "GreyPurchaseOrder_agentId_idx";

-- DropIndex
DROP INDEX "GreyPurchaseOrder_millId_idx";

-- DropIndex
DROP INDEX "GreyPurchaseOrder_supplierId_orderDate_idx";

-- DropIndex
DROP INDEX "Lot_fabricTypeId_idx";

-- DropIndex
DROP INDEX "Lot_godownId_locationId_idx";

-- DropIndex
DROP INDEX "Lot_millId_weaverId_idx";

-- DropIndex
DROP INDEX "Lot_millMarkaId_idx";

-- DropIndex
DROP INDEX "MillProgram_qualityId_codeId_colourId_idx";

-- DropIndex
DROP INDEX "MillProgram_status_millId_idx";

-- DropIndex
DROP INDEX "MillReturn_millId_status_idx";

-- DropIndex
DROP INDEX "Payment_partyId_paidAt_idx";

-- DropIndex
DROP INDEX "SaleBill_partyId_billDate_idx";

-- DropIndex
DROP INDEX "SaleBill_transporterId_idx";

-- DropIndex
DROP INDEX "SalesReturn_millMarkaId_idx";

-- DropIndex
DROP INDEX "SalesReturn_partyId_createdAt_idx";

-- AlterTable
ALTER TABLE "AccountNote" DROP COLUMN "partyId";

-- AlterTable
ALTER TABLE "CommissionEntry" DROP COLUMN "agentId",
DROP COLUMN "relatedPartyId";

-- AlterTable
ALTER TABLE "Dispatch" DROP COLUMN "partyId";

-- AlterTable
ALTER TABLE "GreyPurchaseOrder" DROP COLUMN "agentId",
DROP COLUMN "millId",
DROP COLUMN "supplierId";

-- AlterTable
ALTER TABLE "Lot" DROP COLUMN "codeId",
DROP COLUMN "colourId",
DROP COLUMN "fabricTypeId",
DROP COLUMN "finishTypeId",
DROP COLUMN "godownId",
DROP COLUMN "locationId",
DROP COLUMN "millId",
DROP COLUMN "millMarkaId",
DROP COLUMN "qualityId",
DROP COLUMN "weaverId";

-- AlterTable
ALTER TABLE "MillProgram" DROP COLUMN "codeId",
DROP COLUMN "colourId",
DROP COLUMN "fabricTypeId",
DROP COLUMN "finishTypeId",
DROP COLUMN "millId",
DROP COLUMN "qualityId",
DROP COLUMN "weaverId";

-- AlterTable
ALTER TABLE "MillReturn" DROP COLUMN "millId";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "partyId";

-- AlterTable
ALTER TABLE "SaleBill" DROP COLUMN "partyId",
DROP COLUMN "transporterId";

-- AlterTable
ALTER TABLE "SalesReturn" DROP COLUMN "millMarkaId",
DROP COLUMN "partyId";

-- DropTable
DROP TABLE "AgentLink";

-- DropTable
DROP TABLE "Code";

-- DropTable
DROP TABLE "Colour";

-- DropTable
DROP TABLE "FabricType";

-- DropTable
DROP TABLE "FinishType";

-- DropTable
DROP TABLE "Godown";

-- DropTable
DROP TABLE "GodownLocation";

-- DropTable
DROP TABLE "MillMarka";

-- DropTable
DROP TABLE "MillWeaver";

-- DropTable
DROP TABLE "Party";

-- DropTable
DROP TABLE "Quality";

-- DropEnum
DROP TYPE "PartyType";

-- CreateTable
CREATE TABLE "SalesAgent" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "mobileNo" TEXT,
    "phoneNo" TEXT,
    "emailId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "residentNo" TEXT,
    "faxNo" TEXT,
    "panNo" TEXT,
    "gstin" TEXT,
    "compositeNo" TEXT,
    "registrationDate" TIMESTAMP(3),
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesMaster" (
    "id" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "salesAgentId" TEXT NOT NULL,
    "group" TEXT,
    "salesman" TEXT,
    "receiverName" TEXT,
    "cityName" TEXT,
    "distance" DECIMAL(65,30),
    "manager" TEXT,
    "address" TEXT,
    "phoneNo" TEXT,
    "mobileNo" TEXT,
    "faxNo" TEXT,
    "emailId" TEXT,
    "residentNo" TEXT,
    "cityName2" TEXT,
    "address2" TEXT,
    "gstin" TEXT,
    "compositeNo" TEXT,
    "ecoSgstin" TEXT,
    "registrationDate" TIMESTAMP(3),
    "panNo" TEXT,
    "tanNo" TEXT,
    "kstNo" TEXT,
    "cstNo" TEXT,
    "gujaratState" TEXT,
    "tinNo" TEXT,
    "policyNo" TEXT,
    "creditLimit" DECIMAL(65,30),
    "creditDays" INTEGER,
    "openingBalance" DECIMAL(65,30),
    "crDr" "CrDr",
    "tds" DECIMAL(65,30),
    "payment" TEXT,
    "tcsApplicable" BOOLEAN,
    "references" TEXT,
    "transName" TEXT,
    "discountPercentage" DECIMAL(65,30),
    "rdPcs" DECIMAL(65,30),
    "mts" DECIMAL(65,30),
    "excessRate" DECIMAL(65,30),
    "commissionPercentage" DECIMAL(65,30),
    "bankDetail" TEXT,
    "bankName" TEXT,
    "accountNo" TEXT,
    "ifscCode" TEXT,
    "branch" TEXT,
    "udyamRegistrationNumber" TEXT,
    "enterpriseType" TEXT,
    "enterpriseActivity" TEXT,
    "masterType" TEXT NOT NULL DEFAULT 'SALES',
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "transportName" TEXT NOT NULL,
    "phoneNo" TEXT,
    "emailId" TEXT,
    "transIdGstin" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Haste" (
    "id" TEXT NOT NULL,
    "hasteName" TEXT NOT NULL,
    "receiverName" TEXT,
    "cityName" TEXT,
    "distance" DECIMAL(65,30),
    "manager" TEXT,
    "address" TEXT,
    "phoneNo" TEXT,
    "mobileNo" TEXT,
    "faxNo" TEXT,
    "emailId" TEXT,
    "residentNo" TEXT,
    "kstNo" TEXT,
    "gujaratState" TEXT,
    "cstNo" TEXT,
    "transport" TEXT,
    "tinNo" TEXT,
    "policyNo" TEXT,
    "panNo" TEXT,
    "gstin" TEXT,
    "compositeNo" TEXT,
    "registrationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Haste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quality" TEXT,
    "itemCategories" TEXT,
    "itemGroup" TEXT,
    "hsnCode" TEXT,
    "gstPercentage" DECIMAL(65,30),
    "descriptionForGst" TEXT,
    "itemRatePer" TEXT,
    "openingPcs" DECIMAL(65,30),
    "openingMts" DECIMAL(65,30),
    "openingValue" DECIMAL(65,30),
    "ratePerPcs" DECIMAL(65,30),
    "ratePerMts" DECIMAL(65,30),
    "purRatePerPcs" DECIMAL(65,30),
    "purRatePerMts" DECIMAL(65,30),
    "itemFold" TEXT,
    "imagePath1" TEXT,
    "imagePath2" TEXT,
    "imagePath3" TEXT,
    "imagePath4" TEXT,
    "imagePath5" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseAgent" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "accountType" TEXT,
    "contactPerson" TEXT,
    "mobileNo" TEXT,
    "phoneNo" TEXT,
    "emailId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "residentNo" TEXT,
    "faxNo" TEXT,
    "panNo" TEXT,
    "gstin" TEXT,
    "compositeNo" TEXT,
    "registrationDate" TIMESTAMP(3),
    "masterType" TEXT NOT NULL DEFAULT 'PURCHASE_AGENT',
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT,
    "group" TEXT,
    "agent" TEXT,
    "salesman" TEXT,
    "receiverName" TEXT,
    "cityName" TEXT,
    "distance" DECIMAL(65,30),
    "manager" TEXT,
    "address" TEXT,
    "phoneNo" TEXT,
    "mobileNo" TEXT,
    "faxNo" TEXT,
    "emailId" TEXT,
    "residentNo" TEXT,
    "cityName2" TEXT,
    "address2" TEXT,
    "gstin" TEXT,
    "compositeNo" TEXT,
    "ecoSgstin" TEXT,
    "registrationDate" TIMESTAMP(3),
    "panNo" TEXT,
    "tanNo" TEXT,
    "kstNo" TEXT,
    "cstNo" TEXT,
    "gujaratState" TEXT,
    "tinNo" TEXT,
    "policyNo" TEXT,
    "creditLimit" DECIMAL(65,30),
    "creditDays" INTEGER,
    "openingBalance" DECIMAL(65,30),
    "crDr" "CrDr",
    "tds" DECIMAL(65,30),
    "tdsAccount" TEXT,
    "tdsLimit" DECIMAL(65,30),
    "dob" TIMESTAMP(3),
    "references" TEXT,
    "transName" TEXT,
    "discountPercentage" DECIMAL(65,30),
    "rdPcs" DECIMAL(65,30),
    "mts" DECIMAL(65,30),
    "commissionPercentage" DECIMAL(65,30),
    "bankDetail" TEXT,
    "bankName" TEXT,
    "accountNo" TEXT,
    "ifscCode" TEXT,
    "branch" TEXT,
    "udyamRegistrationNumber" TEXT,
    "enterpriseType" TEXT,
    "enterpriseActivity" TEXT,
    "jobType" TEXT,
    "blackListed" BOOLEAN NOT NULL DEFAULT false,
    "masterType" TEXT NOT NULL DEFAULT 'JOB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Mill" (
    "id" TEXT NOT NULL,
    "millName" TEXT NOT NULL,
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
    "tdsAccount" TEXT,
    "tdsLimit" DECIMAL(65,30),
    "dob" TIMESTAMP(3),
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
    "masterType" TEXT NOT NULL DEFAULT 'MILL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesMaster_salesAgentId_idx" ON "SalesMaster"("salesAgentId");

-- CreateIndex
CREATE INDEX "MillProgram_status_idx" ON "MillProgram"("status");

-- AddForeignKey
ALTER TABLE "SalesMaster" ADD CONSTRAINT "SalesMaster_salesAgentId_fkey" FOREIGN KEY ("salesAgentId") REFERENCES "SalesAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
