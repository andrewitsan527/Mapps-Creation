-- Explicit Mill Return Completed confirmation (shortage is not automatic).
ALTER TABLE "MillProgram" ADD COLUMN "returnCompletedAt" TIMESTAMP(3);
ALTER TABLE "MillProgram" ADD COLUMN "shortageQty" DECIMAL(65,30);
