import { prisma } from "@/lib/prisma/client";
import { writeAudit } from "@/lib/audit/log";

/**
 * Xóa dữ liệu theo tenant giữa các test (TRUNCATE tenants CASCADE -> users,
 * user_roles, faculties, departments, audit_logs). Catalog RBAC global
 * (roles/permissions) được giữ lại — seed một lần qua seedRbac().
 */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "tenants" RESTART IDENTITY CASCADE`,
  );
}

/** Tạo tenant test trực tiếp (Tenant là registry, không tenant-scoped). */
export async function createTenant(slug: string, name = slug) {
  return prisma.tenant.create({ data: { slug, name } });
}

export { prisma, writeAudit };
