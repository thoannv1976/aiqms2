import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { hashPassword } from "@/lib/auth/password";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  roleCodes: z.array(z.string()).default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  password: z.string().min(8).optional(),
  roleCodes: z.array(z.string()).optional(),
});

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  isSuperAdmin: true,
  createdAt: true,
  userRoles: { select: { roleId: true, facultyId: true, role: { select: { code: true, name: true } } } },
} satisfies Prisma.UserSelect;

export async function listUsers(p: PageParams) {
  const where: Prisma.UserWhereInput = p.search
    ? {
        OR: [
          { email: { contains: p.search, mode: "insensitive" } },
          { fullName: { contains: p.search, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.user.count({ where }),
  ]);
  return paginated(items, total, p);
}

/** Danh sách rút gọn (id + tên) để chọn người phụ trách — mọi vai trò có quyền xem đều dùng được. */
export async function listMembers() {
  const users = await prisma.user.findMany({
    where: { status: "active" },
    select: { id: true, fullName: true, email: true, userRoles: { select: { role: { select: { code: true } } } } },
    orderBy: { fullName: "asc" },
    take: 500,
  });
  return users.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, roles: u.userRoles.map((r) => r.role.code) }));
}

export async function getUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id }, select: userSelect });
  if (!user) throw notFound("Người dùng không tồn tại");
  return user;
}

async function roleIdsForCodes(codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const roles = await prisma.role.findMany({ where: { code: { in: codes } } });
  if (roles.length !== codes.length) {
    const found = new Set(roles.map((r) => r.code));
    const missing = codes.filter((c) => !found.has(c));
    throw badRequest(`Vai trò không tồn tại: ${missing.join(", ")}`);
  }
  return roles.map((r) => r.id);
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const ctx = requireTenantContext();
  const existing = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });
  if (existing) throw badRequest("Email đã tồn tại trong trường này", "email_taken");

  const roleIds = await roleIdsForCodes(input.roleCodes);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
      createdBy: ctx.actorId,
      userRoles: {
        create: roleIds.map((roleId) => ({
          roleId,
          tenantId: ctx.tenantId,
          createdBy: ctx.actorId,
        })),
      },
    } as unknown as Prisma.UserUncheckedCreateInput,
    select: userSelect,
  });
  await writeAudit({ action: "user.create", entity: "User", entityId: user.id });
  return user;
}

export async function updateUser(id: string, input: z.infer<typeof updateUserSchema>) {
  const ctx = requireTenantContext();
  const current = await prisma.user.findFirst({ where: { id } });
  if (!current) throw notFound("Người dùng không tồn tại");

  const data: Prisma.UserUpdateInput = { updatedBy: ctx.actorId };
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.status !== undefined) data.status = input.status;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  await prisma.user.update({ where: { id }, data });

  if (input.roleCodes) {
    const roleIds = await roleIdsForCodes(input.roleCodes);
    await prisma.userRole.deleteMany({ where: { userId: id } });
    for (const roleId of roleIds) {
      await prisma.userRole.create({
        data: { userId: id, roleId, tenantId: ctx.tenantId, createdBy: ctx.actorId } as unknown as Prisma.UserRoleUncheckedCreateInput,
      });
    }
  }
  await writeAudit({ action: "user.update", entity: "User", entityId: id });
  return getUser(id);
}

export async function deleteUser(id: string) {
  const ctx = requireTenantContext();
  const current = await prisma.user.findFirst({ where: { id } });
  if (!current) throw notFound("Người dùng không tồn tại");
  if (current.isSuperAdmin) throw badRequest("Không thể xóa super-admin");
  // Soft-delete: không xóa cứng.
  await prisma.user.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "user.delete", entity: "User", entityId: id });
}
