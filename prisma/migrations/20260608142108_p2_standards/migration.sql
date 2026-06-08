-- CreateTable
CREATE TABLE "accreditation_standards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL DEFAULT 'programme',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accreditation_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_versions" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standard_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" TEXT NOT NULL,
    "standardVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "titleVi" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "guidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicators" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_scales" (
    "id" TEXT NOT NULL,
    "standardVersionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "labelVi" TEXT NOT NULL,
    "labelEn" TEXT,
    "description" TEXT,

    CONSTRAINT "rating_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggested_evidences" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "suggested_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accreditation_standards_code_key" ON "accreditation_standards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "standard_versions_standardId_version_key" ON "standard_versions"("standardId", "version");

-- CreateIndex
CREATE INDEX "criteria_standardVersionId_order_idx" ON "criteria"("standardVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_standardVersionId_code_key" ON "criteria"("standardVersionId", "code");

-- CreateIndex
CREATE INDEX "requirements_criterionId_order_idx" ON "requirements"("criterionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_criterionId_code_key" ON "requirements"("criterionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_requirementId_code_key" ON "indicators"("requirementId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rating_scales_standardVersionId_level_key" ON "rating_scales"("standardVersionId", "level");

-- CreateIndex
CREATE INDEX "suggested_evidences_criterionId_idx" ON "suggested_evidences"("criterionId");

-- AddForeignKey
ALTER TABLE "standard_versions" ADD CONSTRAINT "standard_versions_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "accreditation_standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "standard_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_scales" ADD CONSTRAINT "rating_scales_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "standard_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_evidences" ADD CONSTRAINT "suggested_evidences_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
