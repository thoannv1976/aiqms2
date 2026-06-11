-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rootId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "documents_tenantId_rootId_idx" ON "documents"("tenantId", "rootId");
