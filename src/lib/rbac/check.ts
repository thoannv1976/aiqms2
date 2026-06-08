import { prisma } from "@/lib/prisma/client";
import { forbidden } from "@/lib/http/responses";
import { requireTenantContext, type TenantContext } from "@/lib/tenant/context";
import type { PermissionCode } from "./permissions";

/** Giải tập quyền hiệu dụng từ danh sách role code (Role/Permission là global). */
export async function permissionsForRoles(
  roleCodes: string[],
): Promise<Set<string>> {
  const set = new Set<string>();
  if (roleCodes.length === 0) return set;
  const roles = await prisma.role.findMany({
    where: { code: { in: roleCodes } },
    include: { permissions: { include: { permission: true } } },
  });
  for (const r of roles) {
    for (const rp of r.permissions) set.add(rp.permission.code);
  }
  return set;
}

export function hasPermission(
  ctx: TenantContext,
  perm: PermissionCode,
): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions?.has(perm) ?? false;
}

/** Ném 403 nếu thiếu quyền. Kiểm tra ở server cho mọi endpoint (không tin client). */
export function requirePermission(perm: PermissionCode): void {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, perm)) {
    throw forbidden(`Thiếu quyền '${perm}'`);
  }
}
