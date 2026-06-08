import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import {
  changeSarStatus,
  createCycle,
  createSar,
  getSar,
  updateCriterionResponse,
} from "@/lib/sar/service";
import { aggregateScores, openReview, scoreCriterion } from "@/lib/sar/internal-review";

let aunVersionId: string;

function asTenant<T>(tenantId: string, actorId: string, fn: () => Promise<T>) {
  return runWithTenant({ tenantId, actorId }, fn);
}

async function setupSar(tenantId: string) {
  return asTenant(tenantId, "u1", async () => {
    const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
    const cycle = await createCycle({ name: "Đợt 2024", year: 2024, standardVersionId: aunVersionId });
    const sar = await createSar({
      assessmentCycleId: cycle.id,
      programmeVersionId: prog.versions[0].id,
      title: "SAR CNTT 2024",
    });
    return sar;
  });
}

describe("P4 — Đợt tự đánh giá + SAR", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    const v = await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } });
    aunVersionId = v.id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tạo SAR tự sinh response cho cả 8 tiêu chí", async () => {
    const t = await createTenantFixture("demo");
    const sar = await setupSar(t.id);
    expect(sar.responses).toHaveLength(8);
    expect(sar.status).toBe("not_started");
  });

  it("điểm tự đánh giá trong thang 7 mức được chấp nhận; ngoài thang bị chặn", async () => {
    const t = await createTenantFixture("demo");
    const sar = await setupSar(t.id);
    await asTenant(t.id, "u1", async () => {
      const detail = await getSar(sar.id);
      const r = detail.responses[0];
      const ok = await updateCriterionResponse(r.id, { selfScore: 5, status: "completed" });
      expect(ok.selfScore).toBe(5);
      await expect(updateCriterionResponse(r.id, { selfScore: 8 })).rejects.toThrow(
        /score_out_of_range|thang/,
      );
    });
  });

  it("vòng đời SAR: not_started -> collecting -> drafting; bước nhảy sai bị chặn", async () => {
    const t = await createTenantFixture("demo");
    const sar = await setupSar(t.id);
    await asTenant(t.id, "u1", async () => {
      await changeSarStatus(sar.id, "collecting");
      const s2 = await changeSarStatus(sar.id, "drafting");
      expect(s2.status).toBe("drafting");
      // drafting -> completed không hợp lệ.
      await expect(changeSarStatus(sar.id, "completed")).rejects.toThrow(
        /invalid_transition|Không thể chuyển/,
      );
    });
  });

  it("rà soát nội bộ: chấm điểm + tổng hợp/so sánh reviewer", async () => {
    const t = await createTenantFixture("demo");
    const sar = await setupSar(t.id);
    const criteria = await prisma.criterion.findMany({ where: { standardVersionId: aunVersionId } });
    const c1 = criteria[0].id;

    // reviewer A
    await asTenant(t.id, "revA", async () => {
      const rv = await openReview(sar.id);
      await scoreCriterion(rv.id, { criterionId: c1, score: 4 });
    });
    // reviewer B
    await asTenant(t.id, "revB", async () => {
      const rv = await openReview(sar.id);
      await scoreCriterion(rv.id, { criterionId: c1, score: 6 });
    });

    const agg = await asTenant(t.id, "qa", () => aggregateScores(sar.id));
    const forC1 = agg.find((a) => a.criterionId === c1)!;
    expect(forC1.reviewerCount).toBe(2);
    expect(forC1.average).toBe(5);
    expect(forC1.min).toBe(4);
    expect(forC1.max).toBe(6);
  });

  it("cách ly tenant: SAR trường A không lọt sang B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await setupSar(a.id);
    const inB = await asTenant(b.id, "u", () => prisma.selfAssessmentReport.findMany());
    expect(inB).toHaveLength(0);
  });
});
