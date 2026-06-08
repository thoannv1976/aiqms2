-- CreateTable
CREATE TABLE "assessment_cycles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "standardVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assessment_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_assessment_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentCycleId" TEXT NOT NULL,
    "programmeVersionId" TEXT NOT NULL,
    "standardVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "self_assessment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sar_criterion_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sarId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "currentState" TEXT,
    "analysis" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "improvementDone" TEXT,
    "improvementPlan" TEXT,
    "selfScore" INTEGER,
    "reviewerComment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "sar_criterion_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sar_comments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sarId" TEXT NOT NULL,
    "criterionId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sar_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sarId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_review_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "internalReviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_review_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_cycles_tenantId_status_idx" ON "assessment_cycles"("tenantId", "status");

-- CreateIndex
CREATE INDEX "assessment_cycles_tenantId_deletedAt_idx" ON "assessment_cycles"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "self_assessment_reports_tenantId_status_idx" ON "self_assessment_reports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "self_assessment_reports_tenantId_assessmentCycleId_idx" ON "self_assessment_reports"("tenantId", "assessmentCycleId");

-- CreateIndex
CREATE INDEX "self_assessment_reports_tenantId_deletedAt_idx" ON "self_assessment_reports"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "sar_criterion_responses_tenantId_sarId_idx" ON "sar_criterion_responses"("tenantId", "sarId");

-- CreateIndex
CREATE UNIQUE INDEX "sar_criterion_responses_sarId_criterionId_key" ON "sar_criterion_responses"("sarId", "criterionId");

-- CreateIndex
CREATE INDEX "sar_comments_tenantId_sarId_idx" ON "sar_comments"("tenantId", "sarId");

-- CreateIndex
CREATE INDEX "internal_reviews_tenantId_sarId_idx" ON "internal_reviews"("tenantId", "sarId");

-- CreateIndex
CREATE UNIQUE INDEX "internal_reviews_sarId_reviewerId_key" ON "internal_reviews"("sarId", "reviewerId");

-- CreateIndex
CREATE INDEX "internal_review_scores_tenantId_internalReviewId_idx" ON "internal_review_scores"("tenantId", "internalReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "internal_review_scores_internalReviewId_criterionId_key" ON "internal_review_scores"("internalReviewId", "criterionId");

-- AddForeignKey
ALTER TABLE "assessment_cycles" ADD CONSTRAINT "assessment_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_assessment_reports" ADD CONSTRAINT "self_assessment_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_assessment_reports" ADD CONSTRAINT "self_assessment_reports_assessmentCycleId_fkey" FOREIGN KEY ("assessmentCycleId") REFERENCES "assessment_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sar_criterion_responses" ADD CONSTRAINT "sar_criterion_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sar_criterion_responses" ADD CONSTRAINT "sar_criterion_responses_sarId_fkey" FOREIGN KEY ("sarId") REFERENCES "self_assessment_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sar_comments" ADD CONSTRAINT "sar_comments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sar_comments" ADD CONSTRAINT "sar_comments_sarId_fkey" FOREIGN KEY ("sarId") REFERENCES "self_assessment_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_reviews" ADD CONSTRAINT "internal_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_reviews" ADD CONSTRAINT "internal_reviews_sarId_fkey" FOREIGN KEY ("sarId") REFERENCES "self_assessment_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_review_scores" ADD CONSTRAINT "internal_review_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_review_scores" ADD CONSTRAINT "internal_review_scores_internalReviewId_fkey" FOREIGN KEY ("internalReviewId") REFERENCES "internal_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
