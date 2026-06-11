-- CreateTable
CREATE TABLE "sar_requirement_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sarId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_assessed',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "sar_requirement_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sar_requirement_responses_tenantId_sarId_idx" ON "sar_requirement_responses"("tenantId", "sarId");

-- CreateIndex
CREATE UNIQUE INDEX "sar_requirement_responses_sarId_requirementId_key" ON "sar_requirement_responses"("sarId", "requirementId");

-- AddForeignKey
ALTER TABLE "sar_requirement_responses" ADD CONSTRAINT "sar_requirement_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sar_requirement_responses" ADD CONSTRAINT "sar_requirement_responses_sarId_fkey" FOREIGN KEY ("sarId") REFERENCES "self_assessment_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
