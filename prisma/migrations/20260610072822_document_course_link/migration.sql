-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "courseId" TEXT;

-- CreateIndex
CREATE INDEX "documents_tenantId_courseId_idx" ON "documents"("tenantId", "courseId");
