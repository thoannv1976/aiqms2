import { prisma } from "@/lib/prisma/client";
import { writeAudit } from "@/lib/audit/log";

/** Xóa sạch dữ liệu giữa các test (raw SQL — không vướng tenant scope). */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "audit_logs", "tenants" RESTART IDENTITY CASCADE`,
  );
}

/** Tạo tenant test trực tiếp (Tenant là registry, không tenant-scoped). */
export async function createTenant(slug: string, name = slug) {
  return prisma.tenant.create({ data: { slug, name } });
}

export { prisma, writeAudit };
