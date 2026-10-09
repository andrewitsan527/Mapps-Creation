-- CreateTable
CREATE TABLE "GreyBillDocument" (
    "id" TEXT NOT NULL,
    "greyBillId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GreyBillDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GreyBillDocument_accessToken_key" ON "GreyBillDocument"("accessToken");

-- CreateIndex
CREATE INDEX "GreyBillDocument_greyBillId_idx" ON "GreyBillDocument"("greyBillId");

-- CreateIndex
CREATE UNIQUE INDEX "GreyBillDocument_greyBillId_kind_key" ON "GreyBillDocument"("greyBillId", "kind");

-- AddForeignKey
ALTER TABLE "GreyBillDocument" ADD CONSTRAINT "GreyBillDocument_greyBillId_fkey" FOREIGN KEY ("greyBillId") REFERENCES "GreyBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
