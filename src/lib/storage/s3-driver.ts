import type { PutOptions, Storage, StoredObject } from "./types";

/**
 * Driver S3-compatible (AWS S3 / MinIO / GCS qua HMAC).
 * SDK được import động để không bắt buộc cài @aws-sdk khi chạy driver local.
 * Cài khi dùng prod: npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3Storage implements Storage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(private readonly cfg: S3Config) {}

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        let mod: typeof import("@aws-sdk/client-s3");
        try {
          mod = await import("@aws-sdk/client-s3");
        } catch {
          throw new Error(
            "Driver S3 cần @aws-sdk/client-s3. Cài: npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner",
          );
        }
        return new mod.S3Client({
          region: this.cfg.region,
          endpoint: this.cfg.endpoint,
          forcePathStyle: !!this.cfg.endpoint,
          credentials: {
            accessKeyId: this.cfg.accessKeyId,
            secretAccessKey: this.cfg.secretAccessKey,
          },
        });
      })();
    }
    return this.clientPromise;
  }

  async put(
    key: string,
    body: Buffer | Uint8Array,
    opts?: PutOptions,
  ): Promise<StoredObject> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: opts?.contentType,
      }),
    );
    return { key, size: body.byteLength, contentType: opts?.contentType };
  }

  async get(key: string): Promise<Buffer | null> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      );
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async url(key: string): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      { expiresIn: 3600 },
    );
  }
}
