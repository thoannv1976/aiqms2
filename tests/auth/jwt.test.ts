import { describe, expect, it } from "vitest";
import { signAuthToken, verifyAuthToken } from "@/lib/auth/jwt";

describe("JWT", () => {
  const payload = {
    sub: "u1",
    tenantId: "t1",
    tenantSlug: "demo",
    roles: ["qa_office"],
    isSuperAdmin: false,
  };

  it("sign + verify roundtrip giữ nguyên payload", async () => {
    const token = await signAuthToken(payload);
    const decoded = await verifyAuthToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it("token sai chữ ký -> null", async () => {
    const token = await signAuthToken(payload);
    const tampered = token.slice(0, -3) + "abc";
    expect(await verifyAuthToken(tampered)).toBeNull();
  });

  it("rác -> null", async () => {
    expect(await verifyAuthToken("not-a-jwt")).toBeNull();
  });
});
