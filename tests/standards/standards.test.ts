import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, createUserFixture, seedRbac, tokenFor } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { createStandard, getStandard, listStandards } from "@/lib/standards/service";
import { runAsSystem } from "@/lib/tenant/context";
import { GET as standardsGET, POST as standardsPOST } from "@/app/api/standards/route";

describe("P2 — Bộ tiêu chuẩn (data-driven, global)", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("seed AUN-QA: 8 tiêu chí, thang 7 mức, có yêu cầu", async () => {
    const standards = await listStandards();
    const aun = standards.find((s) => s.code === "AUN-QA");
    expect(aun).toBeTruthy();
    expect(aun!.activeVersion?.version).toBe("4.0");

    const detail = await getStandard(aun!.id);
    expect(detail.criteria).toHaveLength(8);
    expect(detail.ratingScale).toHaveLength(7);
    expect(detail.criteria[0].code).toBe("C1");
    expect(detail.criteria[0].requirements.length).toBeGreaterThan(0);
  });

  it("bộ tiêu chuẩn dùng chung mọi tenant (global)", async () => {
    const a = await createTenantFixture("truong-a");
    const b = await createTenantFixture("truong-b");
    const ua = await createUserFixture({ tenantId: a.id, email: "a@a.local", roleCodes: ["qa_office"] });
    const ub = await createUserFixture({ tenantId: b.id, email: "b@b.local", roleCodes: ["lecturer"] });

    const ta = await tokenFor({ userId: ua.id, tenantId: a.id, tenantSlug: "truong-a", roles: ["qa_office"] });
    const tb = await tokenFor({ userId: ub.id, tenantId: b.id, tenantSlug: "truong-b", roles: ["lecturer"] });

    const resA = await standardsGET(
      new Request("http://truong-a.localhost/api/standards", {
        headers: { "x-tenant": "truong-a", authorization: `Bearer ${ta}` },
      }),
    );
    const resB = await standardsGET(
      new Request("http://truong-b.localhost/api/standards", {
        headers: { "x-tenant": "truong-b", authorization: `Bearer ${tb}` },
      }),
    );
    const listA = await resA.json();
    const listB = await resB.json();
    expect(listA.some((s: { code: string }) => s.code === "AUN-QA")).toBe(true);
    expect(listB.some((s: { code: string }) => s.code === "AUN-QA")).toBe(true);
  });

  it("data-driven: thêm bộ tiêu chuẩn mới KHÔNG cần sửa code lõi", async () => {
    await prisma.accreditationStandard.deleteMany({ where: { code: "MOET-TEST" } });
    const sys = await createTenantFixture("system-test");
    const created = await runAsSystem(sys.id, () =>
      createStandard({
        code: "MOET-TEST",
        name: "Chuẩn Bộ GD&ĐT (test)",
        level: "programme",
        version: "1.0",
        activate: true,
        description: undefined,
      }),
    );
    expect(created.versions[0].version).toBe("1.0");
    const detail = await getStandard(created.id);
    expect(detail.code).toBe("MOET-TEST");
    expect(detail.selectedVersion?.version).toBe("1.0");
    await prisma.accreditationStandard.deleteMany({ where: { code: "MOET-TEST" } });
  });

  it("POST /api/standards: user thường (không super-admin) -> 403", async () => {
    const a = await createTenantFixture("truong-a");
    const ua = await createUserFixture({ tenantId: a.id, email: "a@a.local", roleCodes: ["qa_office"] });
    const ta = await tokenFor({ userId: ua.id, tenantId: a.id, tenantSlug: "truong-a", roles: ["qa_office"] });
    const res = await standardsPOST(
      new Request("http://truong-a.localhost/api/standards", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tenant": "truong-a", authorization: `Bearer ${ta}` },
        body: JSON.stringify({ code: "X", name: "X" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
