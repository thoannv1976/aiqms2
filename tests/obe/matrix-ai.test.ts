import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import { applyMatrixMappings } from "@/lib/obe/matrix";
import { synthesizeMatrixFromDocs, programmeExtractSummary, evaluateProgramme, suggestProgrammeUpgrade, suggestPeos, suggestPlos, applyProgrammeUpgrade } from "@/lib/ai/features";
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

  it("applyMatrixMappings: khớp mã học phần KHÔNG phân biệt hoa thường + thừa khoảng trắng", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      // AI trả mã viết thường + có khoảng trắng -> vẫn phải khớp học phần "TMAE306".
      const res = await applyMatrixMappings(versionId, {
        ploCourse: [{ courseCode: " tmae306 ", ploCode: "plo1", level: "M" }],
        cloPlo: [],
      });
      expect(res.ploCourse).toBe(1);
      expect(res.errors.length).toBe(0);
      const m = await prisma.ploCourseMapping.findFirst({ where: { plo: { code: "PLO1" } } });
      expect(m?.level).toBe("M");
    });
  });

  it("tổng quan trích xuất + AI đánh giá CTĐT (mock)", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const sum = await programmeExtractSummary(versionId);
      expect(sum.counts.plo).toBe(3);
      expect(sum.counts.peo).toBe(0);
      expect(sum.programme?.code).toBe("SBI");

      const r = await evaluateProgramme(versionId);
      expect(typeof r.review).toBe("string");
      expect(r.review.length).toBeGreaterThan(0);
      expect(r.draftId).toBeTruthy();
      // Bản nháp đã được lưu (human-in-the-loop).
      const draft = await prisma.aiGeneratedDraft.findFirstOrThrow({ where: { id: r.draftId } });
      expect(draft.status).toBe("draft");
      expect(draft.module).toBe("evaluate_programme");
    });
  });

  it("AI viết PEO (mock): sinh PEO bám PLO -> áp dụng vào phiên bản", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const draft = await suggestPeos(versionId);
      expect(draft.peos.length).toBeGreaterThan(0);
      expect(draft.plos.length).toBe(0);
      const res = await applyProgrammeUpgrade(versionId, { peos: draft.peos, plos: [] });
      expect(res.peos).toBe(draft.peos.length);
      const peoCount = await prisma.programmeObjective.count({ where: { programmeVersionId: versionId } });
      expect(peoCount).toBe(draft.peos.length);
    });
  });

  it("AI viết PLO (mock): sinh PLO từ PEO -> áp dụng vào phiên bản", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const draft = await suggestPlos(versionId);
      expect(draft.plos.length).toBeGreaterThan(0);
      expect(draft.peos.length).toBe(0);
      const res = await applyProgrammeUpgrade(versionId, { peos: [], plos: draft.plos });
      expect(res.plos).toBe(draft.plos.length);
    });
  });

  it("AI nâng cấp CTĐT (mock): đề xuất PEO/PLO -> áp dụng upsert vào phiên bản", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const draft = await suggestProgrammeUpgrade(versionId);
      expect(draft.plos.length).toBeGreaterThan(0);
      expect(draft.peos.length).toBeGreaterThan(0);

      const res = await applyProgrammeUpgrade(versionId, { peos: draft.peos, plos: draft.plos });
      expect(res.peos).toBe(draft.peos.length);
      expect(res.plos).toBe(draft.plos.length);
      // PEO mới được tạo; PLO trùng mã được cập nhật (seed có PLO1..3).
      const peoCount = await prisma.programmeObjective.count({ where: { programmeVersionId: versionId } });
      expect(peoCount).toBe(draft.peos.length);
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

  it("synthesizeMatrixFromDocs: JSON bị cắt cụt vẫn cứu được phần hoàn chỉnh", async () => {
    const t = await createTenantFixture("demo");
    const { versionId } = await seedProgramme(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, apiKey: "sk-ant-test" });
      const orig = global.fetch;
      // JSON cắt cụt giữa item cuối (thiếu phần đóng) — mô phỏng output dài bị giới hạn token.
      const truncated =
        '{"ploCourse":[{"courseCode":"TMAE306","ploCode":"PLO1","level":"M"},' +
        '{"courseCode":"TMAE306","ploCode":"PLO2","level":"R"},{"courseCode":"TMAE306","ploCo';
      global.fetch = (async () =>
        new Response(JSON.stringify({ content: [{ type: "text", text: truncated }], usage: { input_tokens: 10, output_tokens: 8000 } }),
          { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
      try {
        const draft = await synthesizeMatrixFromDocs(versionId);
        // 2 item đầu hoàn chỉnh được giữ lại; item cuối cắt cụt bị bỏ.
        expect(draft.ploCourse.length).toBe(2);
        expect(draft.ploCourse.map((m) => m.ploCode).sort()).toEqual(["PLO1", "PLO2"]);
      } finally { global.fetch = orig; }
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
