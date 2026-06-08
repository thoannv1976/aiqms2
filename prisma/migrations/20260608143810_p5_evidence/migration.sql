-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "providerUnit" TEXT,
    "programmeId" TEXT,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_criteria_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_criteria_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_requirement_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_requirement_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_verification_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidences_tenantId_status_idx" ON "evidences"("tenantId", "status");

-- CreateIndex
CREATE INDEX "evidences_tenantId_academicYear_idx" ON "evidences"("tenantId", "academicYear");

-- CreateIndex
CREATE INDEX "evidences_tenantId_deletedAt_idx" ON "evidences"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "evidences_tenantId_code_key" ON "evidences"("tenantId", "code");

-- CreateIndex
CREATE INDEX "evidence_files_tenantId_evidenceId_idx" ON "evidence_files"("tenantId", "evidenceId");

-- CreateIndex
CREATE INDEX "evidence_files_tenantId_hash_idx" ON "evidence_files"("tenantId", "hash");

-- CreateIndex
CREATE INDEX "evidence_links_tenantId_evidenceId_idx" ON "evidence_links"("tenantId", "evidenceId");

-- CreateIndex
CREATE INDEX "evidence_criteria_mappings_tenantId_criterionId_idx" ON "evidence_criteria_mappings"("tenantId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_criteria_mappings_evidenceId_criterionId_key" ON "evidence_criteria_mappings"("evidenceId", "criterionId");

-- CreateIndex
CREATE INDEX "evidence_requirement_mappings_tenantId_requirementId_idx" ON "evidence_requirement_mappings"("tenantId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_requirement_mappings_evidenceId_requirementId_key" ON "evidence_requirement_mappings"("evidenceId", "requirementId");

-- CreateIndex
CREATE INDEX "evidence_verification_logs_tenantId_evidenceId_idx" ON "evidence_verification_logs"("tenantId", "evidenceId");

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_criteria_mappings" ADD CONSTRAINT "evidence_criteria_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_criteria_mappings" ADD CONSTRAINT "evidence_criteria_mappings_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_requirement_mappings" ADD CONSTRAINT "evidence_requirement_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_requirement_mappings" ADD CONSTRAINT "evidence_requirement_mappings_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_verification_logs" ADD CONSTRAINT "evidence_verification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_verification_logs" ADD CONSTRAINT "evidence_verification_logs_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
