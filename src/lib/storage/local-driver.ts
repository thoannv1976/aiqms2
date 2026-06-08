import { promises as fs } from "node:fs";
import path from "node:path";
import type { PutOptions, Storage, StoredObject } from "./types";

/** Driver lưu file trên đĩa local — chỉ dùng cho dev/test. */
export class LocalStorage implements Storage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.baseDir, key);
    const root = path.resolve(this.baseDir);
    if (!full.startsWith(root + path.sep) && full !== root) {
      throw new Error("Key không hợp lệ (path traversal).");
    }
    return full;
  }

  async put(
    key: string,
    body: Buffer | Uint8Array,
    opts?: PutOptions,
  ): Promise<StoredObject> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { key, size: body.byteLength, contentType: opts?.contentType };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async url(key: string): Promise<string> {
    // Dev: phục vụ qua route handler /api/files/[...key]
    return `/api/files/${key}`;
  }
}
