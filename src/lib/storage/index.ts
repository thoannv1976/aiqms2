import { env } from "@/config/env";
import { ApiError } from "@/lib/http/responses";
import { LocalStorage } from "./local-driver";
import { S3Storage } from "./s3-driver";
import type { PutOptions, Storage, StoredObject } from "./types";

export type { Storage, StoredObject, PutOptions } from "./types";
export { tenantKey } from "./types";

let cached: Storage | null = null;

/** Trả về driver storage theo cờ STORAGE_DRIVER. */
export function getStorage(): Storage {
  if (cached) return cached;
  if (env.STORAGE_DRIVER === "s3") {
    cached = new S3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION ?? "us-east-1",
      bucket: requireEnv("S3_BUCKET", env.S3_BUCKET),
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY),
    });
  } else {
    cached = new LocalStorage(env.STORAGE_LOCAL_DIR);
  }
  return cached;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Storage S3 cần biến môi trường ${name}.`);
  return value;
}

/** Cho test. */
export function resetStorageCache() {
  cached = null;
}

/**
 * Ghi file vào storage với lỗi RÕ RÀNG (502 + nguyên nhân + hướng xử lý) thay vì
 * 500 "Lỗi hệ thống" mù — bài học prod: sai cấu hình S3/GCS chỉ thấy 500.
 */
export async function safePut(
  key: string,
  body: Buffer | Uint8Array,
  opts?: PutOptions,
): Promise<StoredObject> {
  try {
    return await getStorage().put(key, body, opts);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[STORAGE] put '${key}' failed (driver=${env.STORAGE_DRIVER})`, e);
    throw new ApiError(
      502,
      `Không ghi được file vào kho lưu trữ (driver ${env.STORAGE_DRIVER}): ${detail.slice(0, 200)}. ` +
        "Kiểm tra cấu hình STORAGE_DRIVER / S3_* (GCS: xem DEPLOY.md mục 7b).",
      "storage_put_failed",
    );
  }
}
