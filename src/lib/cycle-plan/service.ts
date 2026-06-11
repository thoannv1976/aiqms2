import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { badRequest, notFound } from "@/lib/http/responses";
import { notify } from "@/lib/notifications/service";
import { fileCountByTask } from "@/lib/tasks/service";

/** Công việc trong một đợt tự đánh giá (kèm tên người phụ trách + tiêu chí + số minh chứng đã nộp). */
export async function listCycleTasks(cycleId: string) {
  const tasks = await prisma.task.findMany({
    where: { cycleId, deletedAt: null },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId).filter((v): v is string => !!v))];
  const critIds = [...new Set(tasks.map((t) => t.criterionId).filter((v): v is string => !!v))];
  const [users, crits, fileById] = await Promise.all([
    assigneeIds.length ? prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, fullName: true } }) : [],
    critIds.length ? prisma.criterion.findMany({ where: { id: { in: critIds } }, select: { id: true, code: true } }) : [],
    fileCountByTask(tasks.map((t) => t.id)),
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const codeById = new Map(crits.map((c) => [c.id, c.code]));
  return tasks.map((t) => ({
    ...t,
    assigneeName: t.assigneeId ? nameById.get(t.assigneeId) ?? null : null,
    criterionCode: t.criterionId ? codeById.get(t.criterionId) ?? null : null,
    fileCount: fileById.get(t.id) ?? 0,
  }));
}

export const cycleTaskSchema = z.object({
  title: z.string().min(1),
  type: z.string().optional(),
  assigneeId: z.string().optional(),
  criterionCode: z.string().optional(),
  deliverables: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: z.coerce.date().optional(),
});

async function criterionIdForCode(cycleId: string, code?: string): Promise<string | null> {
  if (!code) return null;
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) return null;
  const c = await prisma.criterion.findFirst({ where: { standardVersionId: cycle.standardVersionId, code: code.trim().toUpperCase() } });
  return c?.id ?? null;
}

export async function createCycleTask(cycleId: string, input: z.infer<typeof cycleTaskSchema>) {
  const ctx = requireTenantContext();
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const task = await prisma.task.create({
    data: withTenantId({
      title: input.title,
      type: input.type ?? "cycle",
      cycleId,
      assigneeId: input.assigneeId ?? null,
      criterionId: await criterionIdForCode(cycleId, input.criterionCode),
      deliverables: input.deliverables ?? null,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      createdBy: ctx.actorId,
    }),
  });
  await writeAudit({ action: "cycle.task.create", entity: "Task", entityId: task.id });
  // Phân công -> thông báo ngay.
  if (input.assigneeId) {
    await notify([input.assigneeId], {
      title: `Bạn được phân công: ${task.title}`,
      body: `Đợt "${cycle.name}"${input.deliverables ? ` · Minh chứng cần nộp: ${input.deliverables}` : ""}`,
      link: "/my-tasks",
    });
  }
  return task;
}

// ─── Áp dụng kế hoạch do AI tạo ──────────────────────────────────────────────
export const cyclePlanSchema = z.object({
  tasks: z
    .array(z.object({
      title: z.string(),
      type: z.string().optional(),
      criterionCode: z.string().optional(),
      deliverables: z.string().optional(),
      role: z.string().optional(),
      priority: z.string().optional(), // chuẩn hóa low|normal|high khi ghi
      dueOffsetDays: z.coerce.number().int().optional(),
    }))
    .default([]),
});
const normPriority = (p?: string) => (p === "low" || p === "high" ? p : "normal");
export type CyclePlanDraft = z.infer<typeof cyclePlanSchema>;

/**
 * Tạo hàng loạt công việc từ kế hoạch. `assignByRole` (vai trò -> userId) để GIAO VIỆC
 * tự động theo vai trò đề xuất; người được giao nhận thông báo.
 */
export async function applyCyclePlan(cycleId: string, input: CyclePlanDraft, assignByRole: Record<string, string> = {}) {
  const ctx = requireTenantContext();
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const data = cyclePlanSchema.parse(input);
  if (data.tasks.length === 0) throw badRequest("Kế hoạch rỗng");

  const base = Date.now();
  let created = 0, assigned = 0;
  const notifyCount = new Map<string, number>();
  for (const t of data.tasks) {
    if (!t.title?.trim()) continue;
    const assigneeId = t.role && assignByRole[t.role] ? assignByRole[t.role] : null;
    await prisma.task.create({
      data: withTenantId({
        title: t.title.trim(),
        type: t.type ?? "cycle",
        description: t.role ? `Vai trò đề xuất: ${t.role}` : null,
        cycleId,
        assigneeId,
        criterionId: await criterionIdForCode(cycleId, t.criterionCode),
        deliverables: t.deliverables ?? null,
        priority: normPriority(t.priority),
        dueDate: t.dueOffsetDays != null ? new Date(base + t.dueOffsetDays * 86400000) : null,
        createdBy: ctx.actorId,
      }),
    });
    created++;
    if (assigneeId) { assigned++; notifyCount.set(assigneeId, (notifyCount.get(assigneeId) ?? 0) + 1); }
  }
  // Thông báo tổng hợp cho mỗi người được giao.
  for (const [userId, n] of notifyCount) {
    await notify([userId], {
      title: `Bạn được giao ${n} công việc trong đợt "${cycle.name}"`,
      body: "Vui lòng xem chi tiết và minh chứng cần nộp trong đợt tự đánh giá.",
      link: "/my-tasks",
    });
  }
  await writeAudit({ action: "cycle.plan.apply", entity: "AssessmentCycle", entityId: cycleId, meta: { created, assigned } });
  return { created, assigned };
}

/** Gửi thông báo tới tất cả thành viên được phân công trong đợt. */
export async function notifyCycleMembers(cycleId: string, message?: string) {
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const tasks = await prisma.task.findMany({ where: { cycleId, deletedAt: null, assigneeId: { not: null } }, select: { assigneeId: true } });
  const userIds = [...new Set(tasks.map((t) => t.assigneeId!).filter(Boolean))];
  const res = await notify(userIds, {
    title: `Cập nhật đợt "${cycle.name}"`,
    body: message?.trim() || "Vui lòng kiểm tra công việc được phân công trong đợt tự đánh giá.",
    link: "/my-tasks",
  });
  await writeAudit({ action: "cycle.notify", entity: "AssessmentCycle", entityId: cycleId, meta: { sent: res.sent } });
  return res;
}
