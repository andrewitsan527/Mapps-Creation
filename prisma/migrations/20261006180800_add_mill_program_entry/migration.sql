-- CreateTable
CREATE TABLE "MillProgramEntry" (
    "id" TEXT NOT NULL,
    "srNo" TEXT NOT NULL,
    "programDate" TIMESTAMP(3) NOT NULL,
    "millId" TEXT,
    "millInwardEntryId" TEXT,
    "typeOfFinish" TEXT NOT NULL DEFAULT '',
    "gsm" TEXT NOT NULL DEFAULT '',
    "width" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'saved',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillProgramEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillProgramEntryLine" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "rolls" INTEGER,
    "codeNo" TEXT NOT NULL DEFAULT '',
    "colour" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MillProgramEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MillProgramEntry_srNo_key" ON "MillProgramEntry"("srNo");

-- CreateIndex
CREATE INDEX "MillProgramEntry_millId_idx" ON "MillProgramEntry"("millId");

-- CreateIndex
CREATE INDEX "MillProgramEntry_millInwardEntryId_idx" ON "MillProgramEntry"("millInwardEntryId");

-- CreateIndex
CREATE INDEX "MillProgramEntryLine_programId_idx" ON "MillProgramEntryLine"("programId");

-- AddForeignKey
ALTER TABLE "MillProgramEntry" ADD CONSTRAINT "MillProgramEntry_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Mill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgramEntry" ADD CONSTRAINT "MillProgramEntry_millInwardEntryId_fkey" FOREIGN KEY ("millInwardEntryId") REFERENCES "MillInwardEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillProgramEntryLine" ADD CONSTRAINT "MillProgramEntryLine_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MillProgramEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
