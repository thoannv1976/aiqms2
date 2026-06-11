import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme, addPeo, addPlo } from "@/lib/programmes/service";
import { applyPloMatrixCells, ploMatrix, setPloMatrixCell } from "@/lib/obe/plo-matrix";
import { suggestPloMatrix, evaluateMatrices } from "@/lib/ai/features";
import { updateSettings } from "@/lib/ai/settings";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

async function seed(tenantId: string) {
  return asTenant(tenantId, async () => {
    const prog = await createProgramme({ code: "SBI", name: "TMĐT", level: "bachelor", initialVersion: "2026" });
    const versionId = prog.versions[0].id;
    await addPeo(versionId, { code: "PEO1", description: "Mục tiêu 1" });
    for (const code of ["PLO1", "PLO2", "PLO3"]) await addPlo(versionId, { code, description: `${code} desc` });
    return versionId;
  });
}

describe("Hệ ma trận PLO tổng quát (PEO/teaching/assessment/measurement)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("ploMatrix: cột đúng theo chiều (PEO động, teaching cố định); set & clear ô", async () => {
    const t = await createTenantFixture("demo");
    const versionId = await seed(t.id);
    await asTenant(t.id, async () => {
      const peoM = await ploMatrix(versionId, "peo");
      expect(peoM.columns.map((c) => c.key)).toEqual(["PEO1"]); // lấy động từ PEO
      expect(peoM.plos).toHaveLength(3);

      const teachM = await ploMatrix(versionId, "teaching");
      expect(teachM.columns.map((c) => c.key)).toContain("lecture");
      expect(teachM.textMode).toBe(false);

      const measureM = await ploMatrix(versionId, "measurement");
      expect(measureM.textMode).toBe(true);

      const plo1 = peoM.plos[0].id;
      await setPloMatrixCell({ programmeVersionId: versionId, ploId: plo1, dimension: "peo", colKey: "PEO1", value: "x" });
      let m = await ploMatrix(versionId, "peo");
      expect(m.cells).toEqual([{ ploId: plo1, colKey: "PEO1", value: "x" }]);
      // value rỗng -> xóa.
      await setPloMatrixCell({ programmeVersionId: versionId, ploId: plo1, dimension: "peo", colKey: "PEO1", value: "" });
      m = await ploMatrix(versionId, "peo");
      expect(m.cells).toHaveLength(0);
    });
  });

  it("applyPloMatrixCells: ghi theo mã PLO + cột hợp lệ, bỏ qua mã/cột lạ", async () => {
    const t = await createTenantFixture("demo");
    const versionId = await seed(t.id);
    await asTenant(t.id, async () => {
      const res = await applyPloMatrixCells(versionId, "teaching", {
        cells: [
          { ploCode: "PLO1", colKey: "lecture", value: "x" },
          { ploCode: "PLO2", colKey: "case_study", value: "x" },
          { ploCode: "PLO9", colKey: "lecture", value: "x" }, // PLO không có
          { ploCode: "PLO1", colKey: "khong_co", value: "x" }, // cột lạ
        ],
      });
      expect(res.applied).toBe(2);
      expect(res.errors.length).toBe(2);
      const m = await ploMatrix(versionId, "teaching");
      expect(m.cells).toHaveLength(2);
    });
  });

  it("suggestPloMatrix (AI mock): trả cells hợp lệ, lọc mã/cột lạ", async () => {
    const t = await createTenantFixture("demo");
    const versionId = await seed(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const r = await suggestPloMatrix(versionId, "assessment");
      expect(r.dimension).toBe("assessment");
      expect(Array.isArray(r.cells)).toBe(true);
      for (const c of r.cells) expect(["PLO1", "PLO2", "PLO3"]).toContain(c.ploCode.toUpperCase());
    });
  });

  it("evaluateMatrices (AI mock): trả nhận xét text", async () => {
    const t = await createTenantFixture("demo");
    const versionId = await seed(t.id);
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const review = await evaluateMatrices(versionId);
      expect(review.length).toBeGreaterThan(0);
    });
  });
});
