import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

export const createCourseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  credits: z.number().int().positive().default(3),
});

export async function listCourses(p: PageParams) {
  const where: Prisma.CourseWhereInput = p.search
    ? {
        OR: [
          { code: { contains: p.search, mode: "insensitive" } },
          { name: { contains: p.search, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { code: "asc" },
      skip: p.skip,
      take: p.take,
      include: { clos: { orderBy: { order: "asc" } } },
    }),
    prisma.course.count({ where }),
  ]);
  return paginated(items, total, p);
}

export async function createCourse(input: z.infer<typeof createCourseSchema>) {
  const ctx = requireTenantContext();
  const dup = await prisma.course.findFirst({ where: { code: input.code, deletedAt: null } });
  if (dup) throw badRequest("Mã học phần đã tồn tại", "code_taken");
  const course = await prisma.course.create({
    data: withTenantId({ ...input, createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "course.create", entity: "Course", entityId: course.id });
  return course;
}

export async function deleteCourse(id: string) {
  const ctx = requireTenantContext();
  const c = await prisma.course.findFirst({ where: { id } });
  if (!c) throw notFound("Học phần không tồn tại");
  await prisma.course.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "course.delete", entity: "Course", entityId: id });
}

export const cloSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().positive().default(1),
});

export async function addClo(courseId: string, input: z.infer<typeof cloSchema>) {
  const c = await prisma.course.findFirst({ where: { id: courseId } });
  if (!c) throw badRequest("Học phần không tồn tại");
  return prisma.courseLearningOutcome.create({
    data: withTenantId({ ...input, courseId }),
  });
}
