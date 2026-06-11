-- CreateTable
CREATE TABLE "external_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessorNames" TEXT,
    "siteVisitStart" TIMESTAMP(3),
    "siteVisitEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planned',
    "overallScore" DOUBLE PRECISION,
    "decision" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "external_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_assessment_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalAssessmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "external_assessment_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_assessments_tenantId_sarId_idx" ON "external_assessments"("tenantId", "sarId");

-- CreateIndex
CREATE INDEX "external_assessments_tenantId_deletedAt_idx" ON "external_assessments"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "external_assessment_scores_tenantId_externalAssessmentId_idx" ON "external_assessment_scores"("tenantId", "externalAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "external_assessment_scores_externalAssessmentId_criterionId_key" ON "external_assessment_scores"("externalAssessmentId", "criterionId");

-- AddForeignKey
ALTER TABLE "external_assessments" ADD CONSTRAINT "external_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_assessments" ADD CONSTRAINT "external_assessments_sarId_fkey" FOREIGN KEY ("sarId") REFERENCES "self_assessment_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_assessment_scores" ADD CONSTRAINT "external_assessment_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_assessment_scores" ADD CONSTRAINT "external_assessment_scores_externalAssessmentId_fkey" FOREIGN KEY ("externalAssessmentId") REFERENCES "external_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
