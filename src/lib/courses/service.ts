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
  programmeId: z.string().optional(),
});

export const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
  credits: z.number().int().positive().optional(),
  programmeId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  prerequisites: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  teachingMethods: z.string().nullable().optional(),
  assessmentMethods: z.string().nullable().optional(),
  materials: z.string().nullable().optional(),
  rubric: z.string().nullable().optional(),
});

const programmeSelect = { select: { id: true, code: true, name: true } } as const;

export async function getCourse(id: string) {
  const course = await prisma.course.findFirst({
    where: { id },
    include: { clos: { orderBy: { order: "asc" } }, programme: programmeSelect },
  });
  if (!course) throw notFound("Học phần không tồn tại");
  return course;
}

export async function updateCourse(id: string, input: z.infer<typeof updateCourseSchema>) {
  const ctx = requireTenantContext();
  const current = await prisma.course.findFirst({ where: { id } });
  if (!current) throw notFound("Học phần không tồn tại");
  const course = await prisma.course.update({ where: { id }, data: { ...input, updatedBy: ctx.actorId } });
  await writeAudit({ action: "course.update", entity: "Course", entityId: id });
  return course;
}

export async function listCourses(p: PageParams, filters: { programmeId?: string } = {}) {
  const where: Prisma.CourseWhereInput = { deletedAt: null };
  if (p.search) {
    where.OR = [
      { code: { contains: p.search, mode: "insensitive" } },
      { name: { contains: p.search, mode: "insensitive" } },
    ];
  }
  // "none" -> học phần chưa gán CTĐT.
  if (filters.programmeId === "none") where.programmeId = null;
  else if (filters.programmeId) where.programmeId = filters.programmeId;
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { code: "asc" },
      skip: p.skip,
      take: p.take,
      include: { clos: { orderBy: { order: "asc" } }, programme: programmeSelect },
    }),
    prisma.course.count({ where }),
  ]);

  // Làm giàu: tên người tạo + đã trích xuất từ đề cương (có Document syllabus gắn courseId).
  const creatorIds = [...new Set(items.map((c) => c.createdBy).filter((v): v is string => !!v))];
  const courseIds = items.map((c) => c.id);
  const [users, syllabusDocs] = await Promise.all([
    creatorIds.length ? prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, fullName: true } }) : [],
    courseIds.length ? prisma.document.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, category: "syllabus", deletedAt: null }, _count: { _all: true } }) : [],
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const withSyllabus = new Set(syllabusDocs.map((d) => d.courseId as string));
  const enriched = items.map((c) => ({
    ...c,
    createdByName: c.createdBy ? nameById.get(c.createdBy) ?? null : null,
    cloCount: c.clos.length,
    hasSyllabus: withSyllabus.has(c.id),
    extracted: c.clos.length > 0 || withSyllabus.has(c.id),
  }));
  return paginated(enriched, total, p);
}

/** Xóa mềm nhiều học phần cùng lúc (quản lý kho). */
export async function deleteCoursesBulk(ids: string[]) {
  const ctx = requireTenantContext();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return { deleted: 0 };
  const r = await prisma.course.updateMany({ where: { id: { in: uniq }, deletedAt: null }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "course.bulk_delete", entity: "Course", meta: { deleted: r.count } });
  return { deleted: r.count };
}

export async function createCourse(input: z.infer<typeof createCourseSchema>) {
  const ctx = requireTenantContext();
  // Unique theo (tenant, code) không tính deletedAt: nếu trùng mã đang hoạt động -> báo lỗi;
  // nếu trùng mã ĐÃ XÓA MỀM -> khôi phục + cập nhật (tránh lỗi vi phạm ràng buộc duy nhất).
  const existing = await prisma.course.findFirst({ where: { code: input.code, deletedAt: undefined } });
  if (existing && existing.deletedAt === null) throw badRequest("Mã học phần đã tồn tại", "code_taken");
  if (existing) {
    const course = await prisma.course.update({ where: { id: existing.id }, data: { ...input, deletedAt: null, updatedBy: ctx.actorId } });
    await writeAudit({ action: "course.restore", entity: "Course", entityId: course.id });
    return course;
  }
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
