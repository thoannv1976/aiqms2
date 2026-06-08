import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { seedStandard } from "@/lib/standards/seed";
import { MOET } from "@/lib/standards/moet-data";
import { getStandard, listStandards } from "@/lib/standards/service";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle, createSar } from "@/lib/sar/service";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("P9 — Thêm bộ tiêu chuẩn Bộ GD&ĐT = NẠP DỮ LIỆU (không sửa code lõi)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("seed MOET: 11 tiêu chuẩn + thang 7 mức, dùng chung hạ tầng AUN-QA", async () => {
    await prisma.accreditationStandard.deleteMany({ where: { code: "MOET" } });
    const { standardId } = await seedStandard(prisma, MOET);
    const detail = await getStandard(standardId);
    expect(detail.code).toBe("MOET");
    expect(detail.criteria).toHaveLength(11);
    expect(detail.ratingScale).toHaveLength(7);
    const all = await listStandards();
    expect(all.some((s) => s.code === "MOET")).toBe(true);
    await prisma.accreditationStandard.deleteMany({ where: { code: "MOET" } });
  });

  it("SAR chạy với bộ tiêu chuẩn MOET (tự sinh 11 response) — KHÔNG sửa code lõi", async () => {
    await prisma.accreditationStandard.deleteMany({ where: { code: "MOET" } });
    const { versionId } = await seedStandard(prisma, MOET);
    const t = await createTenantFixture("demo");
    const sar = await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const cycle = await createCycle({ name: "MOET 2024", standardVersionId: versionId });
      return createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR MOET" });
    });
    expect(sar.responses).toHaveLength(11); // 11 tiêu chuẩn MOET
    await prisma.accreditationStandard.deleteMany({ where: { code: "MOET" } });
  });
});
