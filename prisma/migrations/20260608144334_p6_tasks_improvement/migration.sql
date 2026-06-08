-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeId" TEXT,
    "sarId" TEXT,
    "criterionId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "criterionId" TEXT,
    "issue" TEXT,
    "cause" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "improvement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_actions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "pdcaPhase" TEXT NOT NULL DEFAULT 'plan',
    "responsibleUnit" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "improvement_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_kpis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "actual" DOUBLE PRECISION,

    CONSTRAINT "improvement_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_progress_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "percent" INTEGER,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "improvement_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_tenantId_status_idx" ON "tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tasks_tenantId_assigneeId_idx" ON "tasks"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_dueDate_idx" ON "tasks"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_tenantId_deletedAt_idx" ON "tasks"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "task_comments_tenantId_taskId_idx" ON "task_comments"("tenantId", "taskId");

-- CreateIndex
CREATE INDEX "improvement_plans_tenantId_status_idx" ON "improvement_plans"("tenantId", "status");

-- CreateIndex
CREATE INDEX "improvement_plans_tenantId_deletedAt_idx" ON "improvement_plans"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "improvement_actions_tenantId_planId_idx" ON "improvement_actions"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "improvement_kpis_tenantId_planId_idx" ON "improvement_kpis"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "improvement_progress_logs_tenantId_actionId_idx" ON "improvement_progress_logs"("tenantId", "actionId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_plans" ADD CONSTRAINT "improvement_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "improvement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_kpis" ADD CONSTRAINT "improvement_kpis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_kpis" ADD CONSTRAINT "improvement_kpis_planId_fkey" FOREIGN KEY ("planId") REFERENCES "improvement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_progress_logs" ADD CONSTRAINT "improvement_progress_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvement_progress_logs" ADD CONSTRAINT "improvement_progress_logs_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "improvement_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
