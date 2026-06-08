import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, createUserFixture, seedRbac, tokenFor } from "../helpers/fixtures";
import { GET as usersGET } from "@/app/api/users/route";

describe("Cách ly tenant cho User (trên Postgres)", () => {
  beforeAll(seedRbac);
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("admin trường A không thấy user trường B", async () => {
    const a = await createTenantFixture("truong-a");
    const b = await createTenantFixture("truong-b");
    const adminA = await createUserFixture({
      tenantId: a.id,
      email: "admin@a.local",
      roleCodes: ["qa_office"],
    });
    // user chỉ thuộc B
    await createUserFixture({ tenantId: b.id, email: "user@b.local", roleCodes: ["lecturer"] });

    const token = await tokenFor({
      userId: adminA.id,
      tenantId: a.id,
      tenantSlug: "truong-a",
      roles: ["qa_office"],
    });
    const res = await usersGET(
      new Request("http://truong-a.localhost/api/users", {
        headers: { "x-tenant": "truong-a", authorization: `Bearer ${token}` },
      }),
    );
    const body = await res.json();
    const emails = body.items.map((u: { email: string }) => u.email);
    expect(emails).toContain("admin@a.local");
    expect(emails).not.toContain("user@b.local");
    expect(body.total).toBe(1);
  });

  it("token của tenant khác bị từ chối (403)", async () => {
    const a = await createTenantFixture("truong-a");
    const b = await createTenantFixture("truong-b");
    const adminA = await createUserFixture({
      tenantId: a.id,
      email: "admin@a.local",
      roleCodes: ["qa_office"],
    });
    // Token phát cho tenant A nhưng gọi vào tenant B.
    const token = await tokenFor({
      userId: adminA.id,
      tenantId: a.id,
      tenantSlug: "truong-a",
      roles: ["qa_office"],
    });
    const res = await usersGET(
      new Request("http://truong-b.localhost/api/users", {
        headers: { "x-tenant": "truong-b", authorization: `Bearer ${token}` },
      }),
    );
    void b;
    expect(res.status).toBe(403);
  });
});
