import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle, createSar } from "@/lib/sar/service";
import {
  createExternalAssessment,
  getExternalAssessment,
  listExternalAssessments,
  setExternalScore,
  updateExternalAssessment,
} from "@/lib/sar/external-assessment";

let aunVersionId: string;
const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

async function makeSar(tenantId: string) {
  return asTenant(tenantId, async () => {
    const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
    const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId });
    return createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR" });
  });
}

describe("D8 — Module Đánh giá ngoài", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tạo đợt ĐGN, chấm điểm tiêu chí (TB tổng thể), cập nhật kết luận", async () => {
    const t = await createTenantFixture("demo");
    const sar = await makeSar(t.id);
    await asTenant(t.id, async () => {
      const a = await createExternalAssessment({ sarId: sar.id, title: "ĐGN AUN-QA 2026", assessorNames: "GS A, TS B" });
      expect(a.status).toBe("planned");

      const detail = await getExternalAssessment(a.id);
      expect(detail.criteria).toHaveLength(8); // 8 tiêu chí AUN-QA

      await setExternalScore(a.id, { criterionId: detail.criteria[0].criterionId, score: 5, strengths: "Tốt" });
      await setExternalScore(a.id, { criterionId: detail.criteria[1].criterionId, score: 4, areasForImprovement: "Bổ sung minh chứng" });

      const reloaded = await getExternalAssessment(a.id);
      expect(reloaded.overallScore).toBe(4.5); // (5+4)/2
      expect(reloaded.criteria[0].score).toBe(5);

      const updated = await updateExternalAssessment(a.id, { status: "completed", decision: "Đề nghị công nhận" });
      expect(updated.status).toBe("completed");
      expect(updated.decision).toBe("Đề nghị công nhận");

      const list = await listExternalAssessments(sar.id);
      expect(list).toHaveLength(1);
      expect(list[0]._count.scores).toBe(2);
    });
  });

  it("cách ly tenant: đợt ĐGN của trường A không thấy ở B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    const sar = await makeSar(a.id);
    const ea = await asTenant(a.id, () => createExternalAssessment({ sarId: sar.id, title: "X" }));
    await expect(asTenant(b.id, () => getExternalAssessment(ea.id))).rejects.toThrow();
  });
});
