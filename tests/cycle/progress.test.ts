import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle, createSar, getSar, updateCriterionResponse } from "@/lib/sar/service";
import { createEvidence } from "@/lib/evidence/service";
import { cycleProgress } from "@/lib/cycle-progress/service";

let aunVersionId: string;
const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("D4 — Bảng theo dõi tiến độ đợt", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tổng hợp % theo tiêu chí, minh chứng và nhiệm vụ quá hạn", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId, programmeId: prog.id });
      const sar = await createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR" });
      const detail = await getSar(sar.id);
      // Một tiêu chí có phân tích + điểm → ≥ 50%.
      await updateCriterionResponse(detail.responses[0].id, { selfScore: 5, analysis: "Phân tích đầy đủ" });
      await createEvidence({ title: "MC1", criterionIds: [], requirementIds: [] });

      // Nhiệm vụ của đợt: 1 quá hạn (chưa done), 1 đã done.
      await prisma.task.create({ data: withTenantId({ title: "Trễ", cycleId: cycle.id, assigneeId: "u1", status: "todo", dueDate: new Date(Date.now() - 86400000) }) });
      await prisma.task.create({ data: withTenantId({ title: "Xong", cycleId: cycle.id, assigneeId: "u1", status: "done", dueDate: new Date(Date.now() - 86400000) }) });

      const p = await cycleProgress(cycle.id);
      expect(p.sar?.id).toBe(sar.id);
      expect(p.criteria).toHaveLength(8);
      expect(p.criteria[0].completionPercent).toBeGreaterThanOrEqual(50);
      expect(p.evidenceTotal).toBe(1);
      expect(p.tasks.total).toBe(2);
      expect(p.tasks.done).toBe(1);
      expect(p.tasks.overdue).toBe(1);
      expect(p.behind[0].overdue).toBe(1);
      expect(p.overallPercent).toBeGreaterThan(0);
    });
  });
});
