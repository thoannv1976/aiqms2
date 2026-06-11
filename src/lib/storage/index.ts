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
    if (env.NODE_ENV === "production") {
      // Cloud Run: ổ đĩa local KHÔNG bền vững (mất khi restart/scale). Khuyến nghị GCS.
      console.warn("[STORAGE] STORAGE_DRIVER=local trên production — file upload KHÔNG bền vững. Chuyển sang GCS/S3 (xem scripts/setup-gcs.sh, DEPLOY.md mục 7b).");
    }
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

/** Kho lưu trữ có BỀN VỮNG không (S3/GCS) — local trên prod là tạm (mất khi restart). */
export function isDurableStorage(): boolean {
  return env.STORAGE_DRIVER === "s3";
}

export function storageStatus() {
  return {
    driver: env.STORAGE_DRIVER,
    durable: isDurableStorage(),
    bucket: env.STORAGE_DRIVER === "s3" ? env.S3_BUCKET ?? null : null,
  };
}

/**
 * Lỗi RÕ RÀNG khi file không còn trong kho (bytes đã mất dù bản ghi DB còn).
 * Nguyên nhân phổ biến nhất trên Cloud Run: driver `local` ghi vào /tmp tạm bị xóa khi
 * container restart/scale → hướng dẫn bật GCS hoặc tải lại file.
 */
export function storageMissingError(): ApiError {
  if (!isDurableStorage() && env.NODE_ENV === "production") {
    return new ApiError(
      404,
      "File không còn trong kho lưu trữ TẠM. Trên Cloud Run, kho 'local' nằm ở /tmp và bị xóa khi " +
        "máy chủ khởi động lại/mở rộng — nên file upload trước đó bị mất. Hãy BẬT lưu trữ bền vững GCS " +
        "(STORAGE_DRIVER=s3 + S3_*; xem scripts/setup-gcs.sh, DEPLOY.md mục 7b) rồi tải lại file, hoặc dùng " +
        "“Tải lên phiên bản mới” để thay thế.",
      "storage_file_lost",
    );
  }
  return new ApiError(404, "File không tồn tại trong kho lưu trữ.", "not_found");
}
