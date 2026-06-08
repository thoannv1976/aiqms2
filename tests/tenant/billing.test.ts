import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { GET as healthForTenant } from "@/app/api/auth/me/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";

describe("Billing tenant (validUntil / status)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tenant hết hạn -> 403 (không 500)", async () => {
    await prisma.tenant.create({
      data: {
        slug: "hethan",
        name: "Hết hạn",
        validUntil: new Date(Date.now() - 86_400_000),
      },
    });
    const res = await loginPOST(
      new Request("http://hethan.localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tenant": "hethan" },
        body: JSON.stringify({ email: "x@x.local", password: "x" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("tenant_expired");
  });

  it("tenant bị khóa -> 403", async () => {
    await prisma.tenant.create({
      data: { slug: "khoa", name: "Khóa", status: "suspended" },
    });
    const res = await healthForTenant(
      new Request("http://khoa.localhost/api/auth/me", {
        headers: { "x-tenant": "khoa" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("tenant không tồn tại -> 404", async () => {
    const res = await loginPOST(
      new Request("http://nope.localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tenant": "nope" },
        body: JSON.stringify({ email: "x@x.local", password: "x" }),
      }),
    );
    expect(res.status).toBe(404);
  });
});
