import type { PutOptions, Storage, StoredObject } from "./types";

/**
 * Driver S3-compatible (AWS S3 / MinIO / GCS qua HMAC).
 * `@aws-sdk/*` là dependency thật và được khai báo `serverExternalPackages` trong
 * next.config -> import động bằng specifier LITERAL để Next trace & nạp được từ
 * node_modules lúc chạy (tránh stub "module not found" khi dùng specifier động).
 */
export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

async function loadS3() {
  try {
    return await import("@aws-sdk/client-s3");
  } catch (e) {
    throw new Error(
      `Không nạp được @aws-sdk/client-s3 lúc chạy: ${e instanceof Error ? e.message : String(e)}. ` +
        "Đảm bảo package nằm trong dependencies và có trong node_modules của image.",
    );
  }
}

export class S3Storage implements Storage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(private readonly cfg: S3Config) {}

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const mod = await loadS3();
        return new mod.S3Client({
          region: this.cfg.region,
          endpoint: this.cfg.endpoint,
          forcePathStyle: !!this.cfg.endpoint,
          credentials: {
            accessKeyId: this.cfg.accessKeyId,
            secretAccessKey: this.cfg.secretAccessKey,
          },
          // AWS SDK >= 3.729 mặc định gắn checksum x-amz-checksum-crc32 vào PUT —
          // GCS/MinIO không hỗ trợ -> ghi file fail. Chỉ tính checksum khi bắt buộc.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
        });
      })();
    }
    return this.clientPromise;
  }

  async put(key: string, body: Buffer | Uint8Array, opts?: PutOptions): Promise<StoredObject> {
    const { PutObjectCommand } = await loadS3();
    const client = await this.client();
    await client.send(
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: body, ContentType: opts?.contentType }),
    );
    return { key, size: body.byteLength, contentType: opts?.contentType };
  }

  async get(key: string): Promise<Buffer | null> {
    const { GetObjectCommand } = await loadS3();
    const client = await this.client();
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await loadS3();
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await loadS3();
    const client = await this.client();
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async url(key: string): Promise<string> {
    const { GetObjectCommand } = await loadS3();
    const presign = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return presign.getSignedUrl(client, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }
}
