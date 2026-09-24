-- AlterTable
ALTER TABLE "DispatchLine" DROP COLUMN "shadeName",
ADD COLUMN "quality" TEXT,
ADD COLUMN "code" TEXT,
ADD COLUMN "colour" TEXT;
