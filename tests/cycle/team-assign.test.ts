import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle } from "@/lib/sar/service";
import { generateCyclePlan, suggestAccreditationTeam } from "@/lib/ai/features";
import { createAccreditationTeam } from "@/lib/users/service";
import { applyCyclePlan, autoAssignCycleTasks, listCycleTasks } from "@/lib/cycle-plan/service";

let aunVersionId: string;
const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("AI tạo nhóm + tự động phân công công việc", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("AI đề xuất nhóm kiểm định (vai trò hợp lệ + email duy nhất) và tạo tài khoản idempotent", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "SBI", name: "SBI 2026", level: "bachelor", initialVersion: "2026" });
      const cycle = await createCycle({ name: "KD2", standardVersionId: aunVersionId, programmeId: prog.id });

      const { members } = await suggestAccreditationTeam(cycle.id);
      const allowed = new Set(["qa_office", "programme_committee", "faculty", "lecturer", "internal_reviewer", "leadership"]);
      expect(members.length).toBeGreaterThanOrEqual(4);
      expect(members.every((m) => allowed.has(m.roleCode))).toBe(true);
      expect(new Set(members.map((m) => m.email)).size).toBe(members.length); // email không trùng

      const res = await createAccreditationTeam({ members, defaultPassword: "Aiqms@12345" });
      expect(res.created).toBe(members.length);

      // Tạo lại không trùng (idempotent theo email).
      const again = await createAccreditationTeam({ members, defaultPassword: "Aiqms@12345" });
      expect(again.created).toBe(0);
      expect(again.skipped).toBe(members.length);
    });
  });

  it("tự động phân công công việc theo vai trò (mọi việc có người, gửi thông báo)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "SBI", name: "SBI 2026", level: "bachelor", initialVersion: "2026" });
      const cycle = await createCycle({ name: "KD2", standardVersionId: aunVersionId, programmeId: prog.id });

      // Tạo nhóm + kế hoạch.
      const { members } = await suggestAccreditationTeam(cycle.id);
      await createAccreditationTeam({ members });
      const plan = await generateCyclePlan(cycle.id);
      await applyCyclePlan(cycle.id, plan); // chưa giao (không truyền assignByRole)

      const before = await listCycleTasks(cycle.id);
      expect(before.every((x) => x.assigneeId == null)).toBe(true);

      const r = await autoAssignCycleTasks(cycle.id);
      expect(r.assigned).toBeGreaterThan(0);

      const after = await listCycleTasks(cycle.id);
      const assignedCount = after.filter((x) => x.assigneeId != null).length;
      expect(assignedCount).toBe(after.length); // đủ vai trò → mọi việc có người

      // Có thông báo cho người được giao.
      const notifs = await prisma.notification.count();
      expect(notifs).toBeGreaterThan(0);
    });
  });
});
