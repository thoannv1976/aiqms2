import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import { applyMatrixMappings } from "@/lib/obe/matrix";
import { synthesizeMatrixFromDocs } from "@/lib/ai/features";
import { updateSettings } from "@/lib/ai/settings";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

async function seedProgramme(tenantId: string) {
  return asTenant(tenantId, async () => {
    const prog = await createProgramme({ code: "SBI", name: "TMĐT", level: "bachelor", initialVersion: "2026" });
    const versionId = prog.versions[0].id;
    for (const [i, code] of (["PLO1", "PLO2", "PLO3"] as const).entries()) {
      await prisma.programmeLearningOutcome.create({ data: { tenantId, programmeVersionId: versionId, code, description: code, order: i + 1 } });
    }
    const course = await prisma.course.create({ data: { tenantId, code: "TMAE306", name: "Thương mại điện tử", credits: 3 } });
    await prisma.courseLearningOutcome.create({ data: { tenantId, courseId: course.id, code: "CLO1", description: "x", order: 1 } });
    return { versionId };
  });
}

describe("AI tổng hợp ma trận PLO-CLO", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("applyMatrixMappings: ghi PLO×HP (I/R/M theo nhiều ký hiệu) + CLO–PLO, idempotent", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      const res = await applyMatrixMappings(versionId, {
        ploCourse: [
          { courseCode: "TMAE306", ploCode: "PLO1", level: "M" },
          { courseCode: "TMAE306", ploCode: "PLO2", level: "2" }, // 2 -> R
          { courseCode: "TMAE306", ploCode: "PLOX", level: "I" }, // PLO không tồn tại -> bỏ qua
        ],
        cloPlo: [{ courseCode: "TMAE306", cloCode: "CLO1", ploCode: "PLO3" }],
      });
      expect(res.ploCourse).toBe(2);
      expect(res.cloPlo).toBe(1);
      expect(res.errors.length).toBe(1); // PLOX

      const maps = await prisma.ploCourseMapping.findMany({ include: { plo: true } });
      const byPlo = Object.fromEntries(maps.map((m) => [m.plo.code, m.level]));
      expect(byPlo.PLO1).toBe("M");
      expect(byPlo.PLO2).toBe("R");
      expect(await prisma.cloPloMapping.count()).toBe(1);

      // Áp dụng lại (đổi mức) -> cập nhật, không nhân bản.
      await applyMatrixMappings(versionId, { ploCourse: [{ courseCode: "TMAE306", ploCode: "PLO1", level: "I" }], cloPlo: [] });
      const m1 = await prisma.ploCourseMapping.findFirst({ where: { plo: { code: "PLO1" } } });
      expect(m1?.level).toBe("I");
      expect(await prisma.ploCourseMapping.count()).toBe(2);
    });
  });

  it("synthesizeMatrixFromDocs: AI bật (mock) -> trả structure hợp lệ, lọc mã PLO lạ", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const draft = await synthesizeMatrixFromDocs(versionId);
      expect(Array.isArray(draft.ploCourse)).toBe(true);
      expect(Array.isArray(draft.cloPlo)).toBe(true);
      expect(draft.ploCount).toBe(3);
      expect(draft.courseCount).toBe(1);
      // Mọi mã PLO trả về đều thuộc phiên bản (đã lọc).
      for (const m of draft.ploCourse) expect(["PLO1", "PLO2", "PLO3"]).toContain(m.ploCode.toUpperCase());
    });
  });

  it("synthesizeMatrixFromDocs: chưa có PLO -> báo lỗi rõ ràng", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const prog = await createProgramme({ code: "EMPTY", name: "x", level: "bachelor", initialVersion: "2026" });
      await expect(synthesizeMatrixFromDocs(prog.versions[0].id)).rejects.toMatchObject({ status: 400 });
    });
  });
});
