import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PutOptions, Storage, StoredObject } from "./types";

/** Driver lưu file trên đĩa local — dùng cho dev/test và làm fallback tạm khi chưa
 *  cấu hình S3/GCS. Trên môi trường có hệ thống file CHỈ-ĐỌC (vd Cloud Run, chỉ /tmp
 *  ghi được), baseDir cấu hình có thể không ghi được → tự chuyển sang thư mục tạm. */
export class LocalStorage implements Storage {
  private effectiveBase: string | null = null;

  constructor(private readonly baseDir: string) {}

  /** Chọn (một lần) thư mục gốc ghi được: ưu tiên baseDir cấu hình, fallback os.tmpdir(). */
  private async base(): Promise<string> {
    if (this.effectiveBase) return this.effectiveBase;
    const candidates = [path.resolve(this.baseDir), path.join(os.tmpdir(), "aiqms-storage")];
    for (const dir of candidates) {
      try {
        await fs.mkdir(dir, { recursive: true });
        const probe = path.join(dir, ".write-test");
        await fs.writeFile(probe, "ok");
        await fs.unlink(probe).catch(() => {});
        this.effectiveBase = dir;
        return dir;
      } catch {
        // Thử ứng viên kế tiếp (vd baseDir nằm trên FS chỉ-đọc).
      }
    }
    // Fallback cuối: vẫn dùng thư mục tạm (sẽ ném lỗi rõ nếu cũng không ghi được).
    this.effectiveBase = path.join(os.tmpdir(), "aiqms-storage");
    return this.effectiveBase;
  }

  private async resolve(key: string): Promise<string> {
    const root = await this.base();
    const full = path.resolve(root, key);
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
    const full = await this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { key, size: body.byteLength, contentType: opts?.contentType };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(await this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(await this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(await this.resolve(key));
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
