import { prisma } from "@/lib/prisma/client";
import {
  ALL_PERMISSION_CODES,
  PERMISSION_DESCRIPTIONS,
  ROLES,
} from "@/lib/rbac/permissions";
import { hashPassword } from "@/lib/auth/password";
import { signAuthToken } from "@/lib/auth/jwt";
import { runAsSystem } from "@/lib/tenant/context";

/** Seed catalog RBAC (global) một lần cho test DB. */
export async function seedRbac() {
  for (const code of ALL_PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  for (const role of ROLES) {
    const r = await prisma.role.upsert({
      where: { code: role.code },
      update: {},
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
}

export async function createTenantFixture(slug: string) {
  return prisma.tenant.create({ data: { slug, name: slug } });
}

/** Tạo user gắn role trong một tenant (dùng base client, gán tenantId tường minh). */
export async function createUserFixture(opts: {
  tenantId: string;
  email: string;
  password?: string;
  fullName?: string;
  roleCodes?: string[];
  isSuperAdmin?: boolean;
}) {
  const passwordHash = await hashPassword(opts.password ?? "Passw0rd!");
  // bypassTenant: gán tenantId tường minh (fixture xuyên tenant).
  return runAsSystem(opts.tenantId, async () => {
    const user = await prisma.user.create({
      data: {
        tenantId: opts.tenantId,
        email: opts.email,
        fullName: opts.fullName ?? opts.email,
        passwordHash,
        isSuperAdmin: opts.isSuperAdmin ?? false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    for (const code of opts.roleCodes ?? []) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code } });
      await prisma.userRole.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { tenantId: opts.tenantId, userId: user.id, roleId: role.id } as any,
      });
    }
    return user;
  });
}

/** Tạo JWT cho user để gọi authedRoute trong test. */
export async function tokenFor(opts: {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  isSuperAdmin?: boolean;
}) {
  return signAuthToken({
    sub: opts.userId,
    tenantId: opts.tenantId,
    tenantSlug: opts.tenantSlug,
    roles: opts.roles,
    isSuperAdmin: opts.isSuperAdmin ?? false,
  });
}
