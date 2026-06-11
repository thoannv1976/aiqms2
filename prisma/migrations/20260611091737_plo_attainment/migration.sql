-- CreateTable
CREATE TABLE "plo_attainments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programmeVersionId" TEXT NOT NULL,
    "ploId" TEXT NOT NULL,
    "cohort" TEXT,
    "term" TEXT,
    "attainmentRate" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER,
    "target" DOUBLE PRECISION,
    "method" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plo_attainments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plo_attainments_tenantId_programmeVersionId_idx" ON "plo_attainments"("tenantId", "programmeVersionId");

-- CreateIndex
CREATE INDEX "plo_attainments_tenantId_ploId_idx" ON "plo_attainments"("tenantId", "ploId");

-- AddForeignKey
ALTER TABLE "plo_attainments" ADD CONSTRAINT "plo_attainments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_attainments" ADD CONSTRAINT "plo_attainments_programmeVersionId_fkey" FOREIGN KEY ("programmeVersionId") REFERENCES "programme_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_attainments" ADD CONSTRAINT "plo_attainments_ploId_fkey" FOREIGN KEY ("ploId") REFERENCES "programme_learning_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
