import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme, addPlo } from "@/lib/programmes/service";
import { createAttainment, listAttainments, promoteAttainmentsToOutcomes } from "@/lib/obe/plo-attainment";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("D7 — Đo lường mức đạt PLO → C8", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("nhập mức đạt PLO, tổng hợp trung bình → OutcomeMetric (idempotent)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const versionId = prog.versions[0].id;
      const plo = await addPlo(versionId, { code: "PLO1", description: "Năng lực lập trình", order: 1 });

      await createAttainment(versionId, { ploId: plo.id, cohort: "K60", attainmentRate: 80, target: 75 });
      await createAttainment(versionId, { ploId: plo.id, cohort: "K61", attainmentRate: 90 });

      const rows = await listAttainments(versionId);
      expect(rows).toHaveLength(2);

      const res = await promoteAttainmentsToOutcomes(versionId);
      expect(res.ploCount).toBe(1);
      expect(res.created).toBe(1);

      const metric = await prisma.outcomeMetric.findFirstOrThrow({ where: { dataSource: `plo_attainment:${plo.id}` } });
      expect(metric.category).toBe("plo_attainment");
      expect(metric.value).toBe(85); // (80+90)/2

      // Chạy lại cập nhật, không tạo trùng.
      const again = await promoteAttainmentsToOutcomes(versionId);
      expect(again.updated).toBe(1);
      const count = await prisma.outcomeMetric.count({ where: { dataSource: `plo_attainment:${plo.id}` } });
      expect(count).toBe(1);
    });
  });

  it("từ chối PLO không thuộc phiên bản", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      await expect(createAttainment(prog.versions[0].id, { ploId: "khong-ton-tai", attainmentRate: 50 })).rejects.toThrow();
    });
  });
});
