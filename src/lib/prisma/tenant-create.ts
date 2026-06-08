import { requireTenantContext } from "@/lib/tenant/context";

/**
 * Gắn tenantId từ context vào data create của bảng tenant-scoped.
 * - Thỏa kiểu Prisma (tenantId là field bắt buộc) -> không cần cast `as unknown`.
 * - Hoạt động cả khi bypassTenant (super-admin/seed) vì gán tường minh.
 */
export function withTenantId<T extends object>(
  data: T,
): T & { tenantId: string } {
  return { ...data, tenantId: requireTenantContext().tenantId };
}
