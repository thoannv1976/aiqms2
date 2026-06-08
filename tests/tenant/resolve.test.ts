import { describe, expect, it } from "vitest";
import { resolveTenantSlug } from "@/lib/tenant/resolve";

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("resolveTenantSlug", () => {
  it("ưu tiên header X-Tenant", () => {
    expect(
      resolveTenantSlug(req("http://x.localhost/api", { "x-tenant": "truongA" })),
    ).toBe("truonga");
  });

  it("đọc query ?tenant= (test trường con)", () => {
    expect(resolveTenantSlug(req("http://localhost/api?tenant=truongB"))).toBe(
      "truongb",
    );
  });

  it("đọc subdomain <slug>.localhost", () => {
    expect(
      resolveTenantSlug(req("http://hcmus.localhost/api", { host: "hcmus.localhost" })),
    ).toBe("hcmus");
  });

  it("bỏ qua subdomain hệ thống www/admin -> default", () => {
    expect(
      resolveTenantSlug(req("http://www.localhost/api", { host: "www.localhost" })),
    ).toBe("demo");
  });

  it("fallback DEFAULT_TENANT_SLUG khi không có gì", () => {
    expect(resolveTenantSlug(req("http://localhost/api", { host: "localhost" }))).toBe(
      "demo",
    );
  });
});
