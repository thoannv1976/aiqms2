import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createOutcome } from "@/lib/institutional/service";
import { benchmarkReport } from "@/lib/institutional/benchmark";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("D9 — Đối sánh (benchmarking)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("so sánh giá trị với mốc đối sánh, xếp trạng thái + chênh lệch", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await createOutcome({ name: "Tỷ lệ việc làm", category: "employment", value: 92, unit: "%", target: 90, benchmark: 88 });
      await createOutcome({ name: "Hài lòng SV", category: "satisfaction", value: 70, unit: "%", benchmark: 80 });
      await createOutcome({ name: "Chỉ số chưa có mốc", category: "other", value: 5 });

      const rep = await benchmarkReport();
      expect(rep.summary.total).toBe(3);
      expect(rep.summary.benchmarked).toBe(2);
      expect(rep.summary.above).toBe(1);
      expect(rep.summary.below).toBe(1);

      const employment = rep.rows.find((r) => r.name === "Tỷ lệ việc làm")!;
      expect(employment.gapToBenchmark).toBe(4); // 92 - 88
      expect(employment.status).toBe("above");

      const satisfaction = rep.rows.find((r) => r.name === "Hài lòng SV")!;
      expect(satisfaction.gapToBenchmark).toBe(-10);
      expect(satisfaction.status).toBe("below");

      const noBench = rep.rows.find((r) => r.name === "Chỉ số chưa có mốc")!;
      expect(noBench.status).toBe("unknown");
    });
  });
});
