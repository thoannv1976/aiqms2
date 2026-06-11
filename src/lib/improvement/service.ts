import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";
import { getSar } from "@/lib/sar/service";

export const createPlanSchema = z.object({
  title: z.string().min(1),
  criterionId: z.string().optional(),
  issue: z.string().optional(),
  cause: z.string().optional(),
});

export async function createPlan(input: z.infer<typeof createPlanSchema>) {
  const ctx = requireTenantContext();
  const plan = await prisma.improvementPlan.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "improvement.plan.create", entity: "ImprovementPlan", entityId: plan.id });
  return plan;
}

export async function listPlans(p: PageParams) {
  const [items, total] = await Promise.all([
    prisma.improvementPlan.findMany({
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: { _count: { select: { actions: true, kpis: true } } },
    }),
    prisma.improvementPlan.count(),
  ]);
  return paginated(items, total, p);
}

export async function getPlan(id: string) {
  const plan = await prisma.improvementPlan.findFirst({
    where: { id },
    include: { actions: { include: { progress: { orderBy: { createdAt: "desc" } } } }, kpis: true },
  });
  if (!plan) throw notFound("Kế hoạch cải tiến không tồn tại");
  return plan;
}

export const actionSchema = z.object({
  action: z.string().min(1),
  pdcaPhase: z.enum(["plan", "do", "check", "act"]).default("plan"),
  responsibleUnit: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export async function addAction(planId: string, input: z.infer<typeof actionSchema>) {
  const plan = await prisma.improvementPlan.findFirst({ where: { id: planId } });
  if (!plan) throw notFound("Kế hoạch không tồn tại");
  const action = await prisma.improvementAction.create({ data: withTenantId({ planId, ...input }) });
  await writeAudit({ action: "improvement.action.create", entity: "ImprovementAction", entityId: action.id });
  return action;
}

export const kpiSchema = z.object({
  name: z.string().min(1),
  unit: z.string().optional(),
  target: z.number().optional(),
  actual: z.number().optional(),
});

export async function addKpi(planId: string, input: z.infer<typeof kpiSchema>) {
  const plan = await prisma.improvementPlan.findFirst({ where: { id: planId } });
  if (!plan) throw notFound("Kế hoạch không tồn tại");
  return prisma.improvementKpi.create({ data: withTenantId({ planId, ...input }) });
}

export async function logProgress(actionId: string, note: string, percent?: number) {
  const ctx = requireTenantContext();
  const action = await prisma.improvementAction.findFirst({ where: { id: actionId } });
  if (!action) throw notFound("Hành động cải tiến không tồn tại");
  const log = await prisma.improvementProgressLog.create({
    data: withTenantId({ actionId, note, percent, actorId: ctx.actorId }),
  });
  // Cập nhật trạng thái action theo % tiến độ.
  if (percent !== undefined) {
    const status = percent >= 100 ? "done" : percent > 0 ? "doing" : "pending";
    await prisma.improvementAction.update({ where: { id: actionId }, data: { status } });
  }
  return log;
}

/**
 * Tạo kế hoạch cải tiến TỪ ĐIỂM TỒN TẠI của một SAR (C3/D6).
 * Quét từng tiêu chí: gộp "điểm tồn tại" do người dùng nhập + các khoảng trống tự phát hiện
 * (chưa có minh chứng / chưa phân tích / chưa chấm điểm) thành "vấn đề" của một kế hoạch PDCA.
 * Idempotent: bỏ qua tiêu chí đã có kế hoạch (chưa xóa) gắn với nó để tránh trùng lặp.
 */
export async function createPlansFromSarWeaknesses(sarId: string) {
  const ctx = requireTenantContext();
  const sar = await getSar(sarId);
  const created: { id: string; title: string; criterionId: string }[] = [];
  const skipped: { criterion: string; reason: string }[] = [];

  for (const r of sar.responses) {
    const code = r.criterion ? `${r.criterion.code}. ${r.criterion.titleVi}` : r.criterionId;
    const issues: string[] = [];
    if (r.weaknesses?.trim()) issues.push(r.weaknesses.trim());
    const evidenceCount = await prisma.evidenceCriterionMapping.count({ where: { criterionId: r.criterionId } });
    if (evidenceCount === 0) issues.push("Chưa có minh chứng liên kết với tiêu chí.");
    if (!r.analysis?.trim()) issues.push("Chưa có phân tích mức độ đáp ứng.");
    if (r.selfScore == null) issues.push("Chưa chấm điểm tự đánh giá.");

    if (issues.length === 0) {
      skipped.push({ criterion: code, reason: "không phát hiện điểm tồn tại" });
      continue;
    }
    // Idempotent: đã có kế hoạch cho tiêu chí này.
    const existing = await prisma.improvementPlan.findFirst({
      where: { criterionId: r.criterionId, deletedAt: null },
    });
    if (existing) {
      skipped.push({ criterion: code, reason: "đã có kế hoạch cải tiến" });
      continue;
    }
    const plan = await prisma.improvementPlan.create({
      data: withTenantId({
        title: `Cải tiến: ${code}`,
        criterionId: r.criterionId,
        issue: issues.join("\n"),
        cause: r.weaknesses?.trim() || undefined,
        createdBy: ctx.actorId,
      }),
    });
    await writeAudit({ action: "improvement.plan.from_sar", entity: "ImprovementPlan", entityId: plan.id, meta: { sarId } });
    created.push({ id: plan.id, title: plan.title, criterionId: r.criterionId });
  }
  return { sarId, createdCount: created.length, created, skipped };
}

export async function deletePlan(id: string) {
  const ctx = requireTenantContext();
  const plan = await prisma.improvementPlan.findFirst({ where: { id } });
  if (!plan) throw notFound("Kế hoạch không tồn tại");
  await prisma.improvementPlan.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "improvement.plan.delete", entity: "ImprovementPlan", entityId: id });
}
