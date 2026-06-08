import { describe, expect, it } from "vitest";
import { getEnv } from "@/config/env";

describe("getEnv", () => {
  it("nạp được cấu hình test hợp lệ", () => {
    const e = getEnv();
    expect(e.NODE_ENV).toBe("test");
    expect(e.DATABASE_URL).toContain("aiqms_test");
  });

  it("ENCRYPTION_KEY là 32 bytes", () => {
    const e = getEnv();
    expect(Buffer.from(e.ENCRYPTION_KEY, "base64").length).toBe(32);
  });

  it("cờ có kiểu boolean/enum đúng", () => {
    const e = getEnv();
    expect(typeof e.RLS_ENABLED).toBe("boolean");
    expect(["inline", "queue"]).toContain(e.JOB_MODE);
    expect(["local", "s3"]).toContain(e.STORAGE_DRIVER);
  });
});
