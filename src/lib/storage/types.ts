/**
 * Lớp Storage trừu tượng (bài học #7): local ở dev, S3/GCS ở prod — từ ngày 0.
 * Container Cloud Run là ephemeral, KHÔNG ghi thẳng đĩa.
 *
 * key luôn được prefix theo tenant để cách ly dữ liệu file giữa các trường.
 */
export interface PutOptions {
  contentType?: string;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType?: string;
}

export interface Storage {
  /** Lưu nội dung, trả về metadata. */
  put(key: string, body: Buffer | Uint8Array, opts?: PutOptions): Promise<StoredObject>;
  /** Đọc nội dung; trả null nếu không tồn tại. */
  get(key: string): Promise<Buffer | null>;
  /** Xóa (idempotent). */
  delete(key: string): Promise<void>;
  /** Kiểm tra tồn tại. */
  exists(key: string): Promise<boolean>;
  /** URL truy cập (local: đường dẫn API; s3: presigned/public). */
  url(key: string): Promise<string>;
}

/** Tạo key có prefix tenant để cách ly file theo trường. */
export function tenantKey(tenantId: string, ...parts: string[]): string {
  const clean = parts
    .join("/")
    .replace(/^\/+/, "")
    .replace(/\.\.(\/|$)/g, ""); // chặn path traversal
  return `tenants/${tenantId}/${clean}`;
}
