import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { badRequest } from "@/lib/http/responses";

// ─── Ma trận PLO ↔ học phần ─────────────────────────────────────────────────
export const ploCourseSchema = z.object({
  ploId: z.string().min(1),
  courseId: z.string().min(1),
  level: z.enum(["I", "R", "M"]).default("I"),
});

export async function mapPloCourse(input: z.infer<typeof ploCourseSchema>) {
  const plo = await prisma.programmeLearningOutcome.findFirst({ where: { id: input.ploId } });
  const course = await prisma.course.findFirst({ where: { id: input.courseId } });
  if (!plo || !course) throw badRequest("PLO hoặc học phần không tồn tại trong trường này");
  const mapping = await prisma.ploCourseMapping.upsert({
    where: { ploId_courseId: { ploId: input.ploId, courseId: input.courseId } },
    update: { level: input.level },
    create: withTenantId(input),
  });
  await writeAudit({ action: "matrix.plo_course", entity: "PloCourseMapping", entityId: mapping.id });
  return mapping;
}

/** Ma trận PLO-học phần cho một phiên bản CTĐT (dạng bảng). */
export async function ploCourseMatrix(programmeVersionId: string) {
  const plos = await prisma.programmeLearningOutcome.findMany({
    where: { programmeVersionId },
    orderBy: { order: "asc" },
    include: { courseMappings: { include: { course: { select: { id: true, code: true, name: true } } } } },
  });
  return plos.map((plo) => ({
    ploId: plo.id,
    ploCode: plo.code,
    courses: plo.courseMappings.map((m) => ({
      courseId: m.courseId,
      code: m.course.code,
      level: m.level,
    })),
  }));
}

// ─── Ma trận CLO ↔ PLO ──────────────────────────────────────────────────────
export const cloPloSchema = z.object({
  cloId: z.string().min(1),
  ploId: z.string().min(1),
});

export async function mapCloPlo(input: z.infer<typeof cloPloSchema>) {
  const clo = await prisma.courseLearningOutcome.findFirst({ where: { id: input.cloId } });
  const plo = await prisma.programmeLearningOutcome.findFirst({ where: { id: input.ploId } });
  if (!clo || !plo) throw badRequest("CLO hoặc PLO không tồn tại trong trường này");
  const mapping = await prisma.cloPloMapping.upsert({
    where: { cloId_ploId: { cloId: input.cloId, ploId: input.ploId } },
    update: {},
    create: withTenantId(input),
  });
  await writeAudit({ action: "matrix.clo_plo", entity: "CloPloMapping", entityId: mapping.id });
  return mapping;
}
