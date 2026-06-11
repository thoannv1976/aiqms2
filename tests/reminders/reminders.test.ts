import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { dueReminders } from "@/lib/reminders/service";
import { setMailerForTest, type EmailMessage } from "@/lib/email/mailer";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("D5 — Nhắc hạn nhiệm vụ + email", () => {
  beforeEach(resetDb);
  afterEach(() => setMailerForTest(null));
  afterAll(() => prisma.$disconnect());

  it("nhắc người phụ trách nhiệm vụ quá hạn/sắp đến hạn (in-app + email)", async () => {
    const sent: EmailMessage[] = [];
    setMailerForTest({ async send(m) { sent.push(m); return { ok: true }; } });

    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const user = await prisma.user.create({ data: withTenantId({ email: "nv@truong.edu.vn", fullName: "Nguyễn Văn A", passwordHash: "x" }) });
      // 2 nhiệm vụ của user: 1 quá hạn, 1 sắp đến hạn; 1 đã done (bỏ qua).
      await prisma.task.create({ data: withTenantId({ title: "Quá hạn", assigneeId: user.id, status: "todo", dueDate: new Date(Date.now() - 86400000) }) });
      await prisma.task.create({ data: withTenantId({ title: "Sắp hạn", assigneeId: user.id, status: "in_progress", dueDate: new Date(Date.now() + 86400000) }) });
      await prisma.task.create({ data: withTenantId({ title: "Xong rồi", assigneeId: user.id, status: "done", dueDate: new Date(Date.now() - 86400000) }) });

      const res = await dueReminders({ withinDays: 3 });
      expect(res.tasksConsidered).toBe(2);
      expect(res.notified).toBe(1);
      expect(res.emailsSent).toBe(1);

      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("nv@truong.edu.vn");

      const notifs = await prisma.notification.findMany({ where: { userId: user.id } });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].link).toBe("/my-tasks");
    });
  });
});
