import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalStorage } from "@/lib/storage/local-driver";
import { tenantKey } from "@/lib/storage/types";

describe("LocalStorage", () => {
  let dir: string;
  let storage: LocalStorage;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "aiqms-storage-"));
    storage = new LocalStorage(dir);
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("put/get/exists/delete vòng đời cơ bản", async () => {
    const key = tenantKey("t1", "evidence", "a.txt");
    const body = Buffer.from("xin chào");
    const meta = await storage.put(key, body, { contentType: "text/plain" });
    expect(meta.size).toBe(body.byteLength);
    expect(await storage.exists(key)).toBe(true);
    expect((await storage.get(key))?.toString()).toBe("xin chào");
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it("get trả null nếu không tồn tại", async () => {
    expect(await storage.get("tenants/t1/missing")).toBeNull();
  });

  it("tenantKey prefix theo tenant + chặn path traversal", () => {
    expect(tenantKey("t1", "a/b.txt")).toBe("tenants/t1/a/b.txt");
    expect(tenantKey("t1", "../../etc/passwd")).not.toContain("..");
  });

  it("chặn path traversal ở driver", async () => {
    await expect(
      storage.put("../../escape.txt", Buffer.from("x")),
    ).rejects.toThrow(/traversal/i);
  });
});
