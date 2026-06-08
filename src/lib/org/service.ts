import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

// ─── Faculty (Khoa/Viện) ────────────────────────────────────────────────────
export const facultySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export async function listFaculties(p: PageParams) {
  const where: Prisma.FacultyWhereInput = p.search
    ? {
        OR: [
          { code: { contains: p.search, mode: "insensitive" } },
          { name: { contains: p.search, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.faculty.findMany({ where, orderBy: { code: "asc" }, skip: p.skip, take: p.take }),
    prisma.faculty.count({ where }),
  ]);
  return paginated(items, total, p);
}

export async function createFaculty(input: z.infer<typeof facultySchema>) {
  const ctx = requireTenantContext();
  const dup = await prisma.faculty.findFirst({ where: { code: input.code, deletedAt: null } });
  if (dup) throw badRequest("Mã khoa đã tồn tại", "code_taken");
  const faculty = await prisma.faculty.create({
    data: { ...input, createdBy: ctx.actorId } as unknown as Prisma.FacultyUncheckedCreateInput,
  });
  await writeAudit({ action: "faculty.create", entity: "Faculty", entityId: faculty.id });
  return faculty;
}

export async function deleteFaculty(id: string) {
  const ctx = requireTenantContext();
  const current = await prisma.faculty.findFirst({ where: { id } });
  if (!current) throw notFound("Khoa không tồn tại");
  await prisma.faculty.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "faculty.delete", entity: "Faculty", entityId: id });
}

// ─── Department (Bộ môn) ─────────────────────────────────────────────────────
export const departmentSchema = z.object({
  facultyId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
});

export async function listDepartments(p: PageParams) {
  const [items, total] = await Promise.all([
    prisma.department.findMany({
      include: { faculty: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.department.count(),
  ]);
  return paginated(items, total, p);
}

export async function createDepartment(input: z.infer<typeof departmentSchema>) {
  const ctx = requireTenantContext();
  const faculty = await prisma.faculty.findFirst({ where: { id: input.facultyId } });
  if (!faculty) throw badRequest("Khoa không tồn tại trong trường này");
  const dup = await prisma.department.findFirst({ where: { code: input.code, deletedAt: null } });
  if (dup) throw badRequest("Mã bộ môn đã tồn tại", "code_taken");
  const dept = await prisma.department.create({
    data: { ...input, createdBy: ctx.actorId } as unknown as Prisma.DepartmentUncheckedCreateInput,
  });
  await writeAudit({ action: "department.create", entity: "Department", entityId: dept.id });
  return dept;
}
