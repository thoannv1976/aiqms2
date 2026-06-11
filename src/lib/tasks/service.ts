import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";
import { notify } from "@/lib/notifications/service";

export const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  assigneeId: z.string().optional(),
  sarId: z.string().optional(),
  criterionId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  assigneeId: z.string().nullable().optional(),
  deliverables: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export async function createTask(input: z.infer<typeof createTaskSchema>) {
  const ctx = requireTenantContext();
  const task = await prisma.task.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "task.create", entity: "Task", entityId: task.id });
  return task;
}

export async function listTasks(
  p: PageParams,
  filters: { status?: string; assigneeId?: string } = {},
) {
  const where: Prisma.TaskWhereInput = {};
  if (p.search) where.title = { contains: p.search, mode: "insensitive" };
  if (filters.status) where.status = filters.status;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  const [items, total] = await Promise.all([
    prisma.task.findMany({ where, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], skip: p.skip, take: p.take }),
    prisma.task.count({ where }),
  ]);
  return paginated(items, total, p);
}

/** Kanban board: nhiệm vụ nhóm theo cột trạng thái (kèm tên người phụ trách). */
export async function boardView() {
  const tasks = await prisma.task.findMany({ orderBy: { dueDate: "asc" } });
  // Gắn tên người phụ trách (một truy vấn cho toàn bộ assignee).
  const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId).filter((v): v is string => !!v))];
  const users = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const withName = tasks.map((t) => ({ ...t, assigneeName: t.assigneeId ? nameById.get(t.assigneeId) ?? null : null }));
  const columns: Record<string, typeof withName> = { todo: [], in_progress: [], review: [], done: [] };
  for (const t of withName) (columns[t.status] ??= []).push(t);
  return TASK_STATUSES.map((status) => ({ status, tasks: columns[status] ?? [] }));
}

/** Công việc được giao cho người dùng hiện tại (kèm tên đợt + mã tiêu chí). */
export async function listMyTasks() {
  const ctx = requireTenantContext();
  const tasks = await prisma.task.findMany({
    where: { assigneeId: ctx.actorId, deletedAt: null },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  const cycleIds = [...new Set(tasks.map((t) => t.cycleId).filter((v): v is string => !!v))];
  const critIds = [...new Set(tasks.map((t) => t.criterionId).filter((v): v is string => !!v))];
  const [cycles, crits] = await Promise.all([
    cycleIds.length ? prisma.assessmentCycle.findMany({ where: { id: { in: cycleIds } }, select: { id: true, name: true } }) : [],
    critIds.length ? prisma.criterion.findMany({ where: { id: { in: critIds } }, select: { id: true, code: true } }) : [],
  ]);
  const cycleById = new Map(cycles.map((c) => [c.id, c.name]));
  const codeById = new Map(crits.map((c) => [c.id, c.code]));
  return tasks.map((t) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority,
    deliverables: t.deliverables, dueDate: t.dueDate, cycleId: t.cycleId,
    cycleName: t.cycleId ? cycleById.get(t.cycleId) ?? null : null,
    criterionCode: t.criterionId ? codeById.get(t.criterionId) ?? null : null,
  }));
}

export async function updateTask(id: string, input: z.infer<typeof updateTaskSchema>) {
  const ctx = requireTenantContext();
  const existing = await prisma.task.findFirst({ where: { id } });
  if (!existing) throw notFound("Nhiệm vụ không tồn tại");
  const task = await prisma.task.update({ where: { id }, data: { ...input, updatedBy: ctx.actorId } });
  // Phân công mới (đổi người phụ trách) -> thông báo cho người được giao.
  if (input.assigneeId && input.assigneeId !== existing.assigneeId) {
    await notify([input.assigneeId], {
      title: `Bạn được phân công: ${task.title}`,
      body: task.deliverables ? `Minh chứng cần nộp: ${task.deliverables}` : "Có công việc mới được giao cho bạn.",
      link: "/my-tasks",
    });
  }
  await writeAudit({ action: "task.update", entity: "Task", entityId: id });
  return task;
}

export async function addComment(taskId: string, body: string) {
  const ctx = requireTenantContext();
  const task = await prisma.task.findFirst({ where: { id: taskId } });
  if (!task) throw notFound("Nhiệm vụ không tồn tại");
  return prisma.taskComment.create({ data: withTenantId({ taskId, body, authorId: ctx.actorId }) });
}

export async function deleteTask(id: string) {
  const ctx = requireTenantContext();
  const task = await prisma.task.findFirst({ where: { id } });
  if (!task) throw notFound("Nhiệm vụ không tồn tại");
  await prisma.task.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "task.delete", entity: "Task", entityId: id });
}
