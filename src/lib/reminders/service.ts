import { prisma } from "@/lib/prisma/client";
import { env } from "@/config/env";
import { notify } from "@/lib/notifications/service";
import { getMailer } from "@/lib/email/mailer";
import { writeAudit } from "@/lib/audit/log";

/**
 * Nhắc hạn nhiệm vụ tự động (D5): quét nhiệm vụ chưa hoàn thành sắp đến hạn / quá hạn,
 * tạo thông báo trong app + gửi email cho người phụ trách (qua mailer abstraction).
 * Chạy trong phạm vi một tenant (runWithTenant). Có thể gọi định kỳ qua cron / job.
 */
export async function dueReminders(opts: { withinDays?: number } = {}) {
  const withinDays = opts.withinDays ?? env.REMINDER_DUE_WITHIN_DAYS;
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * 86400000);

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { not: "done" },
      assigneeId: { not: null },
      dueDate: { not: null, lte: horizon },
    },
    orderBy: { dueDate: "asc" },
  });
  if (tasks.length === 0) return { tasksConsidered: 0, notified: 0, emailsSent: 0 };

  // Gộp theo người phụ trách.
  const byAssignee = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const id = t.assigneeId!;
    (byAssignee.get(id) ?? byAssignee.set(id, []).get(id)!).push(t);
  }
  const userIds = [...byAssignee.keys()];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, fullName: true } });
  const userById = new Map(users.map((u) => [u.id, u]));
  const mailer = getMailer();

  let notified = 0;
  let emailsSent = 0;
  for (const [assigneeId, list] of byAssignee) {
    const overdue = list.filter((t) => t.dueDate! < now);
    const title = `Nhắc hạn: ${list.length} nhiệm vụ cần xử lý`;
    const lines = list.map((t) => `- ${t.title} (hạn ${t.dueDate!.toLocaleDateString("vi-VN")}${t.dueDate! < now ? ", QUÁ HẠN" : ""})`);
    const body = `Bạn có ${list.length} nhiệm vụ sắp đến hạn/quá hạn (${overdue.length} quá hạn):\n${lines.join("\n")}`;

    await notify([assigneeId], { title, body, link: "/my-tasks" });
    notified++;

    const user = userById.get(assigneeId);
    if (user?.email) {
      const res = await mailer.send({ to: user.email, subject: title, text: `Xin chào ${user.fullName},\n\n${body}\n\nXem chi tiết tại mục Công việc của tôi.` });
      if (res.ok) emailsSent++;
    }
  }
  await writeAudit({ action: "reminder.run", entity: "Task", meta: { tasksConsidered: tasks.length, notified, emailsSent } });
  return { tasksConsidered: tasks.length, notified, emailsSent };
}
