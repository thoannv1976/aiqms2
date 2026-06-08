import { env } from "@/config/env";
import { LocalStorage } from "./local-driver";
import { S3Storage } from "./s3-driver";
import type { Storage } from "./types";

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
