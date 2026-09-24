-- Retag grey-supplier parties to the canonical WEAVER type (same Party IDs / FKs).
UPDATE "Party"
SET "type" = 'WEAVER'
WHERE "type" = 'GREY_SUPPLIER';

-- Historical grey-supplier payouts become weaver payments (same Payment IDs).
UPDATE "Payment"
SET "category" = 'WEAVER_PAYMENT'
WHERE "category" = 'GREY_SUPPLIER_PAYMENT';

-- Drop unused PartyType value.
CREATE TYPE "PartyType_new" AS ENUM ('CLIENT', 'MILL', 'WEAVER', 'AGENT', 'TRANSPORTER', 'OTHER');
ALTER TABLE "Party" ALTER COLUMN "type" TYPE "PartyType_new" USING ("type"::text::"PartyType_new");
DROP TYPE "PartyType";
ALTER TYPE "PartyType_new" RENAME TO "PartyType";

-- Drop unused PaymentCategory value.
ALTER TABLE "Payment" ALTER COLUMN "category" DROP DEFAULT;
CREATE TYPE "PaymentCategory_new" AS ENUM ('CUSTOMER_RECEIPT', 'MILL_PAYMENT', 'WEAVER_PAYMENT', 'AGENT_COMMISSION', 'OTHER');
ALTER TABLE "Payment" ALTER COLUMN "category" TYPE "PaymentCategory_new" USING ("category"::text::"PaymentCategory_new");
DROP TYPE "PaymentCategory";
ALTER TYPE "PaymentCategory_new" RENAME TO "PaymentCategory";
ALTER TABLE "Payment" ALTER COLUMN "category" SET DEFAULT 'CUSTOMER_RECEIPT'::"PaymentCategory";
