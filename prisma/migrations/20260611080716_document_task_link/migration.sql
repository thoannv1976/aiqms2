-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "documents_tenantId_taskId_idx" ON "documents"("tenantId", "taskId");
