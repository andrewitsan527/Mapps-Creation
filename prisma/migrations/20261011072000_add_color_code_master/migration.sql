-- CreateTable
CREATE TABLE "ColorQuality" (
    "id" TEXT NOT NULL,
    "qualityName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorCode" (
    "id" TEXT NOT NULL,
    "qualityId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ColorQuality_qualityName_key" ON "ColorQuality"("qualityName");

-- CreateIndex
CREATE UNIQUE INDEX "ColorCode_colorCode_key" ON "ColorCode"("colorCode");

-- CreateIndex
CREATE INDEX "ColorCode_qualityId_idx" ON "ColorCode"("qualityId");

-- AddForeignKey
ALTER TABLE "ColorCode" ADD CONSTRAINT "ColorCode_qualityId_fkey" FOREIGN KEY ("qualityId") REFERENCES "ColorQuality"("id") ON DELETE CASCADE ON UPDATE CASCADE;
