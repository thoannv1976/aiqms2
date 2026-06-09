-- CreateTable
CREATE TABLE "academic_staff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facultyId" TEXT,
    "fullName" TEXT NOT NULL,
    "academicRank" TEXT,
    "degree" TEXT,
    "specialization" TEXT,
    "position" TEXT,
    "publications" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "academic_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_services" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academicYear" TEXT,
    "metricValue" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "student_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER,
    "capacity" INTEGER,
    "location" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "academicYear" TEXT,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "outcome_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_staff_tenantId_deletedAt_idx" ON "academic_staff"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "academic_staff_tenantId_facultyId_idx" ON "academic_staff"("tenantId", "facultyId");

-- CreateIndex
CREATE INDEX "student_services_tenantId_category_idx" ON "student_services"("tenantId", "category");

-- CreateIndex
CREATE INDEX "student_services_tenantId_deletedAt_idx" ON "student_services"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "facilities_tenantId_type_idx" ON "facilities"("tenantId", "type");

-- CreateIndex
CREATE INDEX "facilities_tenantId_deletedAt_idx" ON "facilities"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "outcome_metrics_tenantId_category_idx" ON "outcome_metrics"("tenantId", "category");

-- CreateIndex
CREATE INDEX "outcome_metrics_tenantId_academicYear_idx" ON "outcome_metrics"("tenantId", "academicYear");

-- CreateIndex
CREATE INDEX "outcome_metrics_tenantId_deletedAt_idx" ON "outcome_metrics"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "academic_staff" ADD CONSTRAINT "academic_staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_services" ADD CONSTRAINT "student_services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_metrics" ADD CONSTRAINT "outcome_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
