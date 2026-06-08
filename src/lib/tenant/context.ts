import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Context theo từng request (KHÔNG dùng biến toàn cục — bài học #4).
 * Tenant id được lấy từ context *tại thời điểm truy vấn*, không đóng băng trong
 * closure, để tránh rò rỉ dữ liệu giữa các trường.
 */
export interface TenantContext {
  tenantId: string;
  /** user id đang thao tác (cho createdBy/updatedBy + audit). */
  actorId?: string;
  /** true => bỏ qua bộ lọc tenant (chỉ dành cho super-admin / seed / job hệ thống). */
  bypassTenant?: boolean;
  /** super-admin nền tảng (toàn quyền, xuyên tenant). */
  isSuperAdmin?: boolean;
  /** roles (code) của user. */
  roles?: string[];
  /** quyền hiệu dụng (đã giải từ roles) để kiểm tra RBAC nhanh trong request. */
  permissions?: Set<string>;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Chạy một hàm trong phạm vi tenant context.
 *
 * Quan trọng: Prisma promises là *lazy* (thực thi lúc await). Ta bọc fn trong một
 * async function và `await` ngay bên trong ALS scope để continuation của truy vấn
 * gắn vào đúng context — nếu trả promise rồi await bên ngoài, context sẽ mất và
 * extension báo "ngoài tenant context".
 */
export function runWithTenant<T>(
  ctx: TenantContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return storage.run(ctx, async () => await fn());
}

/** Lấy context hiện tại (undefined nếu ngoài phạm vi). */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Lấy context, ném lỗi nếu thiếu (dùng ở chỗ bắt buộc có tenant). */
export function requireTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "Không có tenant context. Mọi truy vấn nghiệp vụ phải nằm trong runWithTenant().",
    );
  }
  return ctx;
}

/** Chạy với quyền hệ thống (bỏ qua lọc tenant) — seed, job nền, super-admin. */
export function runAsSystem<T>(
  tenantId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  return runWithTenant({ tenantId, bypassTenant: true }, fn);
}
