-- CreateTable
CREATE TABLE "plo_matrix_cells" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programmeVersionId" TEXT NOT NULL,
    "ploId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "colKey" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT 'x',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "plo_matrix_cells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plo_matrix_cells_tenantId_programmeVersionId_dimension_idx" ON "plo_matrix_cells"("tenantId", "programmeVersionId", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX "plo_matrix_cells_programmeVersionId_ploId_dimension_colKey_key" ON "plo_matrix_cells"("programmeVersionId", "ploId", "dimension", "colKey");

-- AddForeignKey
ALTER TABLE "plo_matrix_cells" ADD CONSTRAINT "plo_matrix_cells_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_matrix_cells" ADD CONSTRAINT "plo_matrix_cells_programmeVersionId_fkey" FOREIGN KEY ("programmeVersionId") REFERENCES "programme_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plo_matrix_cells" ADD CONSTRAINT "plo_matrix_cells_ploId_fkey" FOREIGN KEY ("ploId") REFERENCES "programme_learning_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
