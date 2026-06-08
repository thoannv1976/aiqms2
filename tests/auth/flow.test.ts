import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, createUserFixture, seedRbac, tokenFor } from "../helpers/fixtures";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { GET as usersGET, POST as usersPOST } from "@/app/api/users/route";

function jsonReq(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Auth + RBAC flow (qua route handlers)", () => {
  beforeAll(seedRbac);
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("login đúng -> trả user + Set-Cookie phiên", async () => {
    const t = await createTenantFixture("demo");
    await createUserFixture({
      tenantId: t.id,
      email: "admin@demo.local",
      password: "Secret123!",
      roleCodes: ["qa_office"],
    });

    const res = await loginPOST(
      jsonReq("http://demo.localhost/api/auth/login", {
        email: "admin@demo.local",
        password: "Secret123!",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("aiqms_session=");
    const body = await res.json();
    expect(body.user.roles).toContain("qa_office");
  });

  it("login sai mật khẩu -> 401", async () => {
    const t = await createTenantFixture("demo");
    await createUserFixture({ tenantId: t.id, email: "a@demo.local", password: "Secret123!" });
    const res = await loginPOST(
      jsonReq("http://demo.localhost/api/auth/login", {
        email: "a@demo.local",
        password: "wrong",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("/me yêu cầu token; trả thông tin user", async () => {
    const t = await createTenantFixture("demo");
    const u = await createUserFixture({
      tenantId: t.id,
      email: "admin@demo.local",
      roleCodes: ["qa_office"],
    });
    const token = await tokenFor({
      userId: u.id,
      tenantId: t.id,
      tenantSlug: "demo",
      roles: ["qa_office"],
    });
    const res = await meGET(
      new Request("http://demo.localhost/api/auth/me", {
        headers: { "x-tenant": "demo", authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("admin@demo.local");
  });

  it("/me không token -> 401", async () => {
    await createTenantFixture("demo");
    const res = await meGET(
      new Request("http://demo.localhost/api/auth/me", { headers: { "x-tenant": "demo" } }),
    );
    expect(res.status).toBe(401);
  });

  it("RBAC: có user.manage thì tạo/list user được", async () => {
    const t = await createTenantFixture("demo");
    const admin = await createUserFixture({
      tenantId: t.id,
      email: "admin@demo.local",
      roleCodes: ["qa_office"],
    });
    const token = await tokenFor({
      userId: admin.id,
      tenantId: t.id,
      tenantSlug: "demo",
      roles: ["qa_office"],
    });
    const auth = { "x-tenant": "demo", authorization: `Bearer ${token}` };

    const createRes = await usersPOST(
      jsonReq(
        "http://demo.localhost/api/users",
        { email: "gv@demo.local", fullName: "GV", password: "Passw0rd!", roleCodes: ["lecturer"] },
        auth,
      ),
    );
    expect(createRes.status).toBe(201);

    const listRes = await usersGET(
      new Request("http://demo.localhost/api/users", { headers: auth }),
    );
    const list = await listRes.json();
    expect(list.total).toBe(2);
    expect(list.page).toBe(1);
  });

  it("RBAC: thiếu user.manage -> 403 khi tạo user", async () => {
    const t = await createTenantFixture("demo");
    const gv = await createUserFixture({
      tenantId: t.id,
      email: "gv@demo.local",
      roleCodes: ["lecturer"],
    });
    const token = await tokenFor({
      userId: gv.id,
      tenantId: t.id,
      tenantSlug: "demo",
      roles: ["lecturer"],
    });
    const res = await usersPOST(
      jsonReq(
        "http://demo.localhost/api/users",
        { email: "x@demo.local", fullName: "X", password: "Passw0rd!" },
        { "x-tenant": "demo", authorization: `Bearer ${token}` },
      ),
    );
    expect(res.status).toBe(403);
  });
});
