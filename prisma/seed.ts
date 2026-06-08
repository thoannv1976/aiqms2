import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  PERMISSION_DESCRIPTIONS,
  ROLES,
  ALL_PERMISSION_CODES,
} from "../src/lib/rbac/permissions";
import { seedAunqa, seedStandard } from "../src/lib/standards/seed";
import { MOET } from "../src/lib/standards/moet-data";

/**
 * Seed idempotent (bài học #seed): chạy lại nhiều lần không nhân bản, và VẪN tạo
 * super-admin trên DB đã có dữ liệu (app trước thiếu điều này -> prod không có super-admin).
 *
 * Dùng PrismaClient gốc (KHÔNG tenant extension) vì seed thao tác xuyên tenant.
 */
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // 1) Permissions (catalog global) ─────────────────────────────────────────
  for (const code of ALL_PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] },
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  console.log(`✔ Permissions: ${ALL_PERMISSION_CODES.length}`);

  // 2) Roles + role-permissions (đồng bộ với catalog) ─────────────────────────
  for (const role of ROLES) {
    const r = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { code: role.code, name: role.name, description: role.description },
    });
    const perms = await prisma.permission.findMany({
      where: { code: { in: role.permissions } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: r.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`✔ Roles: ${ROLES.length}`);

  // 3) System tenant + super-admin ───────────────────────────────────────────
  const systemSlug = process.env.SYSTEM_TENANT_SLUG ?? "system";
  const systemTenant = await prisma.tenant.upsert({
    where: { slug: systemSlug },
    update: {},
    create: { slug: systemSlug, name: "Nền tảng (System)", status: "active" },
  });

  const saEmail = process.env.SUPERADMIN_EMAIL ?? "superadmin@aiqms.local";
  const saPassword = process.env.SUPERADMIN_PASSWORD ?? "ChangeMe123!";
  const superRole = await prisma.role.findUniqueOrThrow({ where: { code: "super_admin" } });
  const sa = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: systemTenant.id, email: saEmail } },
    update: { isSuperAdmin: true, status: "active" },
    create: {
      tenantId: systemTenant.id,
      email: saEmail,
      fullName: "Super Admin",
      passwordHash: await bcrypt.hash(saPassword, 10),
      isSuperAdmin: true,
    },
  });
  const saHasRole = await prisma.userRole.findFirst({
    where: { userId: sa.id, roleId: superRole.id },
  });
  if (!saHasRole) {
    await prisma.userRole.create({
      data: { tenantId: systemTenant.id, userId: sa.id, roleId: superRole.id },
    });
  }
  console.log(`✔ Super-admin: ${saEmail} @ ${systemSlug}`);

  // 4) Tenant demo + 1 admin trường (qa_office) ──────────────────────────────
  const demoSlug = process.env.DEFAULT_TENANT_SLUG ?? "demo";
  const demo = await prisma.tenant.upsert({
    where: { slug: demoSlug },
    update: {},
    create: { slug: demoSlug, name: "Trường Đại học Demo", status: "active" },
  });
  const qaRole = await prisma.role.findUniqueOrThrow({ where: { code: "qa_office" } });
  const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL ?? "admin@demo.local";
  const demoAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: demoAdminEmail } },
    update: {},
    create: {
      tenantId: demo.id,
      email: demoAdminEmail,
      fullName: "Quản trị Trường Demo",
      passwordHash: await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD ?? "Demo1234!", 10),
    },
  });
  const hasRole = await prisma.userRole.findFirst({
    where: { userId: demoAdmin.id, roleId: qaRole.id },
  });
  if (!hasRole) {
    await prisma.userRole.create({
      data: { tenantId: demo.id, userId: demoAdmin.id, roleId: qaRole.id },
    });
  }
  console.log(`✔ Tenant demo: ${demo.slug} | admin: ${demoAdminEmail}`);

  // 5) Bộ tiêu chuẩn AUN-QA v4.0 (global, data-driven) ────────────────────────
  const aun = await seedAunqa(prisma);
  console.log(`✔ AUN-QA v4.0: 8 tiêu chí + thang 7 mức (version ${aun.versionId})`);

  // 6) Bộ tiêu chuẩn Bộ GD&ĐT (P9) — thêm bằng NẠP DỮ LIỆU, không sửa code lõi.
  const moet = await seedStandard(prisma, MOET);
  console.log(`✔ MOET 2016: 11 tiêu chuẩn (version ${moet.versionId})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
