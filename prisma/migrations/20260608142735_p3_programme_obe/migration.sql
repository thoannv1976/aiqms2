-- CreateTable
CREATE TABLE "programmes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facultyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "level" TEXT NOT NULL DEFAULT 'bachelor',
    "totalCredits" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "year" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "educationalPhilosophy" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "programme_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme_objectives" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programmeVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme_learning_outcomes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programmeVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_learning_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_learning_outcomes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_learning_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plo_course_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ploId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'I',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plo_course_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clo_plo_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cloId" TEXT NOT NULL,
    "ploId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clo_plo_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programmes_tenantId_deletedAt_idx" ON "programmes"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "programmes_tenantId_facultyId_idx" ON "programmes"("tenantId", "facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "programmes_tenantId_code_key" ON "programmes"("tenantId", "code");

-- CreateIndex
CREATE INDEX "programme_versions_tenantId_programmeId_idx" ON "programme_versions"("tenantId", "programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "programme_versions_tenantId_programmeId_version_key" ON "programme_versions"("tenantId", "programmeId", "version");

-- CreateIndex
CREATE INDEX "programme_objectives_tenantId_programmeVersionId_idx" ON "programme_objectives"("tenantId", "programmeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "programme_objectives_programmeVersionId_code_key" ON "programme_objectives"("programmeVersionId", "code");

-- CreateIndex
CREATE INDEX "programme_learning_outcomes_tenantId_programmeVersionId_idx" ON "programme_learning_outcomes"("tenantId", "programmeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "programme_learning_outcomes_programmeVersionId_code_key" ON "programme_learning_outcomes"("programmeVersionId", "code");

-- CreateIndex
CREATE INDEX "courses_tenantId_deletedAt_idx" ON "courses"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "courses_tenantId_code_key" ON "courses"("tenantId", "code");

-- CreateIndex
CREATE INDEX "course_learning_outcomes_tenantId_courseId_idx" ON "course_learning_outcomes"("tenantId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_learning_outcomes_courseId_code_key" ON "course_learning_outcomes"("courseId", "code");

-- CreateIndex
CREATE INDEX "plo_course_mappings_tenantId_ploId_idx" ON "plo_course_mappings"("tenantId", "ploId");

-- CreateIndex
CREATE INDEX "plo_course_mappings_tenantId_courseId_idx" ON "plo_course_mappings"("tenantId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "plo_course_mappings_ploId_courseId_key" ON "plo_course_mappings"("ploId", "courseId");

-- CreateIndex
CREATE INDEX "clo_plo_mappings_tenantId_cloId_idx" ON "clo_plo_mappings"("tenantId", "cloId");

-- CreateIndex
CREATE INDEX "clo_plo_mappings_tenantId_ploId_idx" ON "clo_plo_mappings"("tenantId", "ploId");

-- CreateIndex
CREATE UNIQUE INDEX "clo_plo_mappings_cloId_ploId_key" ON "clo_plo_mappings"("cloId", "ploId");

-- AddForeignKey
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_versions" ADD CONSTRAINT "programme_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_versions" ADD CONSTRAINT "programme_versions_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_objectives" ADD CONSTRAINT "programme_objectives_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_objectives" ADD CONSTRAINT "programme_objectives_programmeVersionId_fkey" FOREIGN KEY ("programmeVersionId") REFERENCES "programme_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_learning_outcomes" ADD CONSTRAINT "programme_learning_outcomes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_learning_outcomes" ADD CONSTRAINT "programme_learning_outcomes_programmeVersionId_fkey" FOREIGN KEY ("programmeVersionId") REFERENCES "programme_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "course_learning_outcomes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "course_learning_outcomes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_course_mappings" ADD CONSTRAINT "plo_course_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_course_mappings" ADD CONSTRAINT "plo_course_mappings_ploId_fkey" FOREIGN KEY ("ploId") REFERENCES "programme_learning_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_course_mappings" ADD CONSTRAINT "plo_course_mappings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "clo_plo_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "clo_plo_mappings_cloId_fkey" FOREIGN KEY ("cloId") REFERENCES "course_learning_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "clo_plo_mappings_ploId_fkey" FOREIGN KEY ("ploId") REFERENCES "programme_learning_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
