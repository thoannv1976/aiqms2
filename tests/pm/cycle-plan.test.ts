import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { createCycle } from "@/lib/sar/service";
import { applyCyclePlan, createCycleTask, listCycleTasks, notifyCycleMembers } from "@/lib/cycle-plan/service";
import { generateCyclePlan } from "@/lib/ai/features";
import { listMyNotifications } from "@/lib/notifications/service";
import { updateSettings } from "@/lib/ai/settings";
import { createUser } from "@/lib/users/service";

let aunVersionId: string;
const asUser = <T>(tenantId: string, actorId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId }, fn);

describe("Kế hoạch đợt tự đánh giá + phân công + thông báo", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tạo công việc đợt + phân công -> gửi thông báo cho người được giao", async () => {
    const t = await createTenantFixture("demo");
    await asUser(t.id, "admin", async () => {
      const member = await createUser({ email: "gv@demo.local", fullName: "Giảng viên A", password: "password123", roleCodes: [] });
      const cycle = await createCycle({ name: "Đợt 2025", standardVersionId: aunVersionId });

      const task = await createCycleTask(cycle.id, {
        title: "Thu thập minh chứng C1", criterionCode: "C1", assigneeId: member.id,
        deliverables: "Bảng PLO + biên bản", priority: "high",
      });
      expect(task.cycleId).toBe(cycle.id);
      expect(task.deliverables).toContain("biên bản");

      const list = await listCycleTasks(cycle.id);
      expect(list).toHaveLength(1);
      expect(list[0].assigneeName).toBe("Giảng viên A");
      expect(list[0].criterionCode).toBe("C1");

      // Người được giao nhận thông báo.
      const noti = await asUser(t.id, member.id, () => listMyNotifications());
      expect(noti.unread).toBe(1);
      expect(noti.items[0].title).toContain("Thu thập minh chứng C1");
      expect(noti.items[0].link).toBe(`/cycles/${cycle.id}`);
    });
  });

  it("applyCyclePlan: tạo hàng loạt công việc, gán tiêu chí theo mã + hạn theo offset", async () => {
    const t = await createTenantFixture("demo");
    await asUser(t.id, "admin", async () => {
      const cycle = await createCycle({ name: "Đợt", standardVersionId: aunVersionId });
      const res = await applyCyclePlan(cycle.id, {
        tasks: [
          { title: "Viết SAR C2", criterionCode: "C2", deliverables: "Bản thảo SAR", dueOffsetDays: 14 },
          { title: "Họp kế hoạch", role: "qa_office" },
        ],
      });
      expect(res.created).toBe(2);
      const list = await listCycleTasks(cycle.id);
      expect(list.find((x) => x.title === "Viết SAR C2")?.criterionCode).toBe("C2");
      expect(list.find((x) => x.title === "Viết SAR C2")?.dueDate).toBeTruthy();
    });
  });

  it("AI generateCyclePlan (mock): trả cấu trúc tasks hợp lệ", async () => {
    const t = await createTenantFixture("demo");
    await asUser(t.id, "admin", async () => {
      await updateSettings({ enabled: true });
      const cycle = await createCycle({ name: "Đợt", standardVersionId: aunVersionId });
      const plan = await generateCyclePlan(cycle.id);
      expect(Array.isArray(plan.tasks)).toBe(true);
    });
  });

  it("notifyCycleMembers: gửi cho tất cả người được phân công (khử trùng)", async () => {
    const t = await createTenantFixture("demo");
    await asUser(t.id, "admin", async () => {
      const m1 = await createUser({ email: "a@demo.local", fullName: "A", password: "password123", roleCodes: [] });
      const cycle = await createCycle({ name: "Đợt", standardVersionId: aunVersionId });
      await createCycleTask(cycle.id, { title: "T1", assigneeId: m1.id, priority: "normal" });
      await createCycleTask(cycle.id, { title: "T2", assigneeId: m1.id, priority: "normal" });
      const res = await notifyCycleMembers(cycle.id, "Nhắc tiến độ");
      expect(res.sent).toBe(1); // khử trùng -> 1 người
      const noti = await asUser(t.id, m1.id, () => listMyNotifications());
      expect(noti.items.some((n) => n.body === "Nhắc tiến độ")).toBe(true);
    });
  });
});
