import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

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

/** Kanban board: nhiệm vụ nhóm theo cột trạng thái. */
export async function boardView() {
  const tasks = await prisma.task.findMany({ orderBy: { dueDate: "asc" } });
  const columns: Record<string, typeof tasks> = { todo: [], in_progress: [], review: [], done: [] };
  for (const t of tasks) (columns[t.status] ??= []).push(t);
  return TASK_STATUSES.map((status) => ({ status, tasks: columns[status] ?? [] }));
}

export async function updateTask(id: string, input: z.infer<typeof updateTaskSchema>) {
  const ctx = requireTenantContext();
  const existing = await prisma.task.findFirst({ where: { id } });
  if (!existing) throw notFound("Nhiệm vụ không tồn tại");
  const task = await prisma.task.update({ where: { id }, data: { ...input, updatedBy: ctx.actorId } });
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
