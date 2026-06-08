-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resultKey" TEXT,
    "fileName" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_jobs_tenantId_status_idx" ON "export_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "export_jobs_tenantId_createdAt_idx" ON "export_jobs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
