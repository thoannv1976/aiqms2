-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "programmeId" TEXT;

-- CreateIndex
CREATE INDEX "courses_tenantId_programmeId_idx" ON "courses"("tenantId", "programmeId");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
