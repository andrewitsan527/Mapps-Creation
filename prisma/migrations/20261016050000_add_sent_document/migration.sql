-- CreateTable
CREATE TABLE "SentDocument" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "millInwardEntryId" TEXT,
    "millProgramEntryId" TEXT,
    "recipient" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SentDocument_accessToken_key" ON "SentDocument"("accessToken");

-- CreateIndex
CREATE INDEX "SentDocument_millInwardEntryId_idx" ON "SentDocument"("millInwardEntryId");

-- CreateIndex
CREATE INDEX "SentDocument_millProgramEntryId_idx" ON "SentDocument"("millProgramEntryId");

-- AddForeignKey
ALTER TABLE "SentDocument" ADD CONSTRAINT "SentDocument_millInwardEntryId_fkey" FOREIGN KEY ("millInwardEntryId") REFERENCES "MillInwardEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentDocument" ADD CONSTRAINT "SentDocument_millProgramEntryId_fkey" FOREIGN KEY ("millProgramEntryId") REFERENCES "MillProgramEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
