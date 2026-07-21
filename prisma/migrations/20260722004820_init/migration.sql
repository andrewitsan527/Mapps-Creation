-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'SALES', 'STORE', 'QC', 'ACCOUNTS', 'DISPATCH');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CLIENT', 'MILL', 'WEAVER', 'GREY_SUPPLIER', 'AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'SENT_TO_MILL', 'IN_PROCESS', 'RETURNED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DefectType" AS ENUM ('NONE', 'MILL', 'WEAVER', 'DYEING', 'MINOR');

-- CreateEnum
CREATE TYPE "LotOrigin" AS ENUM ('PROGRAM', 'SALES_RETURN');

-- CreateEnum
CREATE TYPE "GoodsReturnStatus" AS ENUM ('PENDING_QC', 'IN_STOCK', 'CLOSED');

-- CreateEnum
CREATE TYPE "MillReturnStatus" AS ENUM ('OPEN', 'SENT', 'CLOSED');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "QualityGrade" AS ENUM ('A', 'B', 'C', 'REJECT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'RESERVE', 'RELEASE', 'ADJUST', 'RETURN');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('RECEIPT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentCategory" AS ENUM ('CUSTOMER_RECEIPT', 'MILL_PAYMENT', 'WEAVER_PAYMENT', 'GREY_SUPPLIER_PAYMENT', 'AGENT_COMMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'ISSUED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('PROVISIONAL', 'SALE');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'STUB');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('MILL', 'WEAVER', 'PARTY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "gstin" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "interestRatePct" DECIMAL(65,30) NOT NULL DEFAULT 28.5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillMarka" (
    "id" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillMarka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLink" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "relatedPartyId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "defaultUnit" TEXT NOT NULL DEFAULT 'm',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shade" (
    "id" TEXT NOT NULL,
    "colorFamilyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,
    "swatchUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Godown" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Godown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GodownLocation" (
    "id" TEXT NOT NULL,
    "godownId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "capacity" DECIMAL(65,30),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GodownLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreyPurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fabricNotes" TEXT,
    "quantity" DECIMAL(65,30),
    "unit" TEXT NOT NULL DEFAULT 'm',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "whatsappNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreyPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreyPurchaseBill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreyPurchaseBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillProgram" (
    "id" TEXT NOT NULL,
    "programNo" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "weaverId" TEXT,
    "greyOrderId" TEXT,
    "fabricTypeId" TEXT NOT NULL,
    "shadeId" TEXT NOT NULL,
    "finishTypeId" TEXT,
    "width" DECIMAL(65,30),
    "gsm" DECIMAL(65,30),
    "feelFallNotes" TEXT,
    "extraMods" TEXT,
    "remarks" TEXT,
    "photoUrl" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "rollNumber" TEXT,
    "marka" TEXT,
    "millMarkaId" TEXT,
    "fabricTypeId" TEXT NOT NULL,
    "shadeId" TEXT NOT NULL,
    "finishTypeId" TEXT,
    "programId" TEXT,
    "greyOrderId" TEXT,
    "millId" TEXT,
    "weaverId" TEXT,
    "godownId" TEXT,
    "locationId" TEXT,
    "width" DECIMAL(65,30),
    "gsm" DECIMAL(65,30),
    "quantity" DECIMAL(65,30) NOT NULL,
    "lengthM" DECIMAL(65,30),
    "weightKg" DECIMAL(65,30),
    "rollCount" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'm',
    "qualityGrade" "QualityGrade" NOT NULL DEFAULT 'A',
    "defectType" "DefectType" NOT NULL DEFAULT 'NONE',
    "origin" "LotOrigin" NOT NULL DEFAULT 'PROGRAM',
    "returnPriority" "DefectSeverity",
    "sourceSaleBillId" TEXT,
    "parentLotId" TEXT,
    "onHand" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotRoll" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "lengthM" DECIMAL(65,30) NOT NULL,
    "weightKg" DECIMAL(65,30),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityCheck" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,
    "defectType" "DefectType" NOT NULL DEFAULT 'NONE',
    "severity" "DefectSeverity",
    "grade" "QualityGrade" NOT NULL DEFAULT 'A',
    "remarks" TEXT,
    "photoUrl" TEXT,
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "checklistWeaver" BOOLEAN NOT NULL DEFAULT false,
    "checklistMill" BOOLEAN NOT NULL DEFAULT false,
    "checklistDying" BOOLEAN NOT NULL DEFAULT false,
    "checklistMinor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleBill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "type" "BillType" NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "partyId" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentTermsDays" INTEGER,
    "interestRatePct" DECIMAL(65,30),
    "creditStartsAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "preDueReminderSentAt" TIMESTAMP(3),
    "dueReminderSentAt" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "gstPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tdsPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tdsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "provisionalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotNumber" TEXT,
    "fabricName" TEXT,
    "colorFamily" TEXT,
    "shadeName" TEXT,
    "shadeCode" TEXT,
    "finishName" TEXT,
    "millName" TEXT,
    "weaverName" TEXT,
    "width" DECIMAL(65,30),
    "gsm" DECIMAL(65,30),
    "marka" TEXT,
    "rollNumber" TEXT,
    "rollCount" INTEGER,
    "weightKg" DECIMAL(65,30),
    "lengthM" DECIMAL(65,30),
    "rollsDetail" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'm',
    "rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "SaleBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "saleBillId" TEXT,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatchedAt" TIMESTAMP(3),
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchLine" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "lotNumber" TEXT,
    "fabricName" TEXT,
    "shadeName" TEXT,
    "rollsDetail" TEXT,

    CONSTRAINT "DispatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL DEFAULT 'RECEIPT',
    "category" "PaymentCategory" NOT NULL DEFAULT 'CUSTOMER_RECEIPT',
    "saleBillId" TEXT,
    "commissionEntryId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "status" "WhatsAppStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrail" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountNote" (
    "id" TEXT NOT NULL,
    "noteNo" TEXT NOT NULL,
    "type" "NoteType" NOT NULL,
    "partyId" TEXT NOT NULL,
    "saleBillId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "tdsPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tdsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "basis" "CommissionBasis" NOT NULL,
    "relatedPartyId" TEXT,
    "saleBillId" TEXT,
    "ratePct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReturn" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "status" "GoodsReturnStatus" NOT NULL DEFAULT 'PENDING_QC',
    "priority" "DefectSeverity" NOT NULL DEFAULT 'MEDIUM',
    "partyId" TEXT NOT NULL,
    "saleBillId" TEXT,
    "saleBillLineId" TEXT,
    "millMarkaId" TEXT,
    "markaPhotoUrl" TEXT,
    "originalLotId" TEXT,
    "newLotId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "qualityGrade" "QualityGrade",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillReturn" (
    "id" TEXT NOT NULL,
    "rfNo" TEXT NOT NULL,
    "status" "MillReturnStatus" NOT NULL DEFAULT 'OPEN',
    "lotId" TEXT NOT NULL,
    "millId" TEXT NOT NULL,
    "qualityCheckId" TEXT,
    "source" "LotOrigin" NOT NULL DEFAULT 'PROGRAM',
    "qcAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "goodsSummary" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Party_type_name_idx" ON "Party"("type", "name");

-- CreateIndex
CREATE INDEX "Party_active_type_idx" ON "Party"("active", "type");

-- CreateIndex
CREATE INDEX "MillMarka_millId_active_idx" ON "MillMarka"("millId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MillMarka_millId_code_key" ON "MillMarka"("millId", "code");

-- CreateIndex
CREATE INDEX "AgentLink_agentId_idx" ON "AgentLink"("agentId");

-- CreateIndex
CREATE INDEX "AgentLink_relatedPartyId_idx" ON "AgentLink"("relatedPartyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentLink_agentId_relatedPartyId_key" ON "AgentLink"("agentId", "relatedPartyId");

-- CreateIndex
CREATE UNIQUE INDEX "FabricType_name_key" ON "FabricType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FabricType_code_key" ON "FabricType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ColorFamily_name_key" ON "ColorFamily"("name");

-- CreateIndex
CREATE INDEX "Shade_name_idx" ON "Shade"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Shade_colorFamilyId_code_key" ON "Shade"("colorFamilyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FinishType_name_key" ON "FinishType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Godown_name_key" ON "Godown"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Godown_code_key" ON "Godown"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GodownLocation_godownId_code_key" ON "GodownLocation"("godownId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GreyPurchaseOrder_poNumber_key" ON "GreyPurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "GreyPurchaseOrder_supplierId_orderDate_idx" ON "GreyPurchaseOrder"("supplierId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "GreyPurchaseBill_orderId_billNo_key" ON "GreyPurchaseBill"("orderId", "billNo");

-- CreateIndex
CREATE UNIQUE INDEX "MillProgram_programNo_key" ON "MillProgram"("programNo");

-- CreateIndex
CREATE INDEX "MillProgram_status_millId_idx" ON "MillProgram"("status", "millId");

-- CreateIndex
CREATE INDEX "MillProgram_shadeId_fabricTypeId_idx" ON "MillProgram"("shadeId", "fabricTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_lotNumber_key" ON "Lot"("lotNumber");

-- CreateIndex
CREATE INDEX "Lot_fabricTypeId_shadeId_idx" ON "Lot"("fabricTypeId", "shadeId");

-- CreateIndex
CREATE INDEX "Lot_marka_idx" ON "Lot"("marka");

-- CreateIndex
CREATE INDEX "Lot_godownId_locationId_idx" ON "Lot"("godownId", "locationId");

-- CreateIndex
CREATE INDEX "Lot_programId_idx" ON "Lot"("programId");

-- CreateIndex
CREATE INDEX "Lot_millId_weaverId_idx" ON "Lot"("millId", "weaverId");

-- CreateIndex
CREATE INDEX "Lot_millMarkaId_idx" ON "Lot"("millMarkaId");

-- CreateIndex
CREATE INDEX "Lot_origin_qualityGrade_idx" ON "Lot"("origin", "qualityGrade");

-- CreateIndex
CREATE INDEX "Lot_sourceSaleBillId_idx" ON "Lot"("sourceSaleBillId");

-- CreateIndex
CREATE INDEX "LotRoll_lotId_idx" ON "LotRoll"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "LotRoll_lotId_rollNo_key" ON "LotRoll"("lotId", "rollNo");

-- CreateIndex
CREATE INDEX "QualityCheck_defectType_severity_idx" ON "QualityCheck"("defectType", "severity");

-- CreateIndex
CREATE INDEX "QualityCheck_checkedAt_idx" ON "QualityCheck"("checkedAt");

-- CreateIndex
CREATE INDEX "StockMovement_lotId_createdAt_idx" ON "StockMovement"("lotId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleBill_billNo_key" ON "SaleBill"("billNo");

-- CreateIndex
CREATE UNIQUE INDEX "SaleBill_provisionalId_key" ON "SaleBill"("provisionalId");

-- CreateIndex
CREATE INDEX "SaleBill_partyId_billDate_idx" ON "SaleBill"("partyId", "billDate");

-- CreateIndex
CREATE INDEX "SaleBill_type_status_idx" ON "SaleBill"("type", "status");

-- CreateIndex
CREATE INDEX "SaleBill_dueDate_idx" ON "SaleBill"("dueDate");

-- CreateIndex
CREATE INDEX "SaleBillLine_billId_idx" ON "SaleBillLine"("billId");

-- CreateIndex
CREATE INDEX "SaleBillLine_lotId_idx" ON "SaleBillLine"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_challanNo_key" ON "Dispatch"("challanNo");

-- CreateIndex
CREATE INDEX "Dispatch_partyId_status_idx" ON "Dispatch"("partyId", "status");

-- CreateIndex
CREATE INDEX "Dispatch_saleBillId_idx" ON "Dispatch"("saleBillId");

-- CreateIndex
CREATE INDEX "DispatchLine_dispatchId_idx" ON "DispatchLine"("dispatchId");

-- CreateIndex
CREATE INDEX "Payment_partyId_paidAt_idx" ON "Payment"("partyId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_direction_category_paidAt_idx" ON "Payment"("direction", "category", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_commissionEntryId_idx" ON "Payment"("commissionEntryId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_entityType_entityId_idx" ON "WhatsAppMessageLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_status_createdAt_idx" ON "WhatsAppMessageLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditTrail_entityType_entityId_idx" ON "AuditTrail"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditTrail_createdAt_idx" ON "AuditTrail"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountNote_noteNo_key" ON "AccountNote"("noteNo");

-- CreateIndex
CREATE INDEX "AccountNote_partyId_type_idx" ON "AccountNote"("partyId", "type");

-- CreateIndex
CREATE INDEX "AccountNote_saleBillId_idx" ON "AccountNote"("saleBillId");

-- CreateIndex
CREATE INDEX "CommissionEntry_agentId_createdAt_idx" ON "CommissionEntry"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_basis_idx" ON "CommissionEntry"("basis");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_returnNo_key" ON "SalesReturn"("returnNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_newLotId_key" ON "SalesReturn"("newLotId");

-- CreateIndex
CREATE INDEX "SalesReturn_partyId_createdAt_idx" ON "SalesReturn"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesReturn_status_priority_idx" ON "SalesReturn"("status", "priority");

-- CreateIndex
CREATE INDEX "SalesReturn_saleBillId_idx" ON "SalesReturn"("saleBillId");

-- CreateIndex
CREATE INDEX "SalesReturn_originalLotId_idx" ON "SalesReturn"("originalLotId");

-- CreateIndex
CREATE INDEX "SalesReturn_millMarkaId_idx" ON "SalesReturn"("millMarkaId");

-- CreateIndex
CREATE UNIQUE INDEX "MillReturn_rfNo_key" ON "MillReturn"("rfNo");

-- CreateIndex
CREATE INDEX "MillReturn_status_dueAt_idx" ON "MillReturn"("status", "dueAt");

-- CreateIndex
CREATE INDEX "MillReturn_lotId_idx" ON "MillReturn"("lotId");

-- CreateIndex
CREATE INDEX "MillReturn_millId_status_idx" ON "MillReturn"("millId", "status");

-- CreateIndex
CREATE INDEX "MillReturn_qualityCheckId_idx" ON "MillReturn"("qualityCheckId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillMarka" ADD CONSTRAINT "MillMarka_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLink" ADD CONSTRAINT "AgentLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLink" ADD CONSTRAINT "AgentLink_relatedPartyId_fkey" FOREIGN KEY ("relatedPartyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shade" ADD CONSTRAINT "Shade_colorFamilyId_fkey" FOREIGN KEY ("colorFamilyId") REFERENCES "ColorFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownLocation" ADD CONSTRAINT "GodownLocation_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyPurchaseOrder" ADD CONSTRAINT "GreyPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreyPurchaseBill" ADD CONSTRAINT "GreyPurchaseBill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "GreyPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_greyOrderId_fkey" FOREIGN KEY ("greyOrderId") REFERENCES "GreyPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "FabricType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_shadeId_fkey" FOREIGN KEY ("shadeId") REFERENCES "Shade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgram" ADD CONSTRAINT "MillProgram_finishTypeId_fkey" FOREIGN KEY ("finishTypeId") REFERENCES "FinishType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_millMarkaId_fkey" FOREIGN KEY ("millMarkaId") REFERENCES "MillMarka"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "FabricType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_shadeId_fkey" FOREIGN KEY ("shadeId") REFERENCES "Shade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_finishTypeId_fkey" FOREIGN KEY ("finishTypeId") REFERENCES "FinishType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MillProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_greyOrderId_fkey" FOREIGN KEY ("greyOrderId") REFERENCES "GreyPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_weaverId_fkey" FOREIGN KEY ("weaverId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "GodownLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_sourceSaleBillId_fkey" FOREIGN KEY ("sourceSaleBillId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_parentLotId_fkey" FOREIGN KEY ("parentLotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotRoll" ADD CONSTRAINT "LotRoll_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheck" ADD CONSTRAINT "QualityCheck_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleBill" ADD CONSTRAINT "SaleBill_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleBill" ADD CONSTRAINT "SaleBill_provisionalId_fkey" FOREIGN KEY ("provisionalId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleBillLine" ADD CONSTRAINT "SaleBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SaleBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleBillLine" ADD CONSTRAINT "SaleBillLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_saleBillId_fkey" FOREIGN KEY ("saleBillId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLine" ADD CONSTRAINT "DispatchLine_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLine" ADD CONSTRAINT "DispatchLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleBillId_fkey" FOREIGN KEY ("saleBillId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_commissionEntryId_fkey" FOREIGN KEY ("commissionEntryId") REFERENCES "CommissionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTrail" ADD CONSTRAINT "AuditTrail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountNote" ADD CONSTRAINT "AccountNote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountNote" ADD CONSTRAINT "AccountNote_saleBillId_fkey" FOREIGN KEY ("saleBillId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_relatedPartyId_fkey" FOREIGN KEY ("relatedPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_saleBillId_fkey" FOREIGN KEY ("saleBillId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_saleBillId_fkey" FOREIGN KEY ("saleBillId") REFERENCES "SaleBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_millMarkaId_fkey" FOREIGN KEY ("millMarkaId") REFERENCES "MillMarka"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_originalLotId_fkey" FOREIGN KEY ("originalLotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_newLotId_fkey" FOREIGN KEY ("newLotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillReturn" ADD CONSTRAINT "MillReturn_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillReturn" ADD CONSTRAINT "MillReturn_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillReturn" ADD CONSTRAINT "MillReturn_qualityCheckId_fkey" FOREIGN KEY ("qualityCheckId") REFERENCES "QualityCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

