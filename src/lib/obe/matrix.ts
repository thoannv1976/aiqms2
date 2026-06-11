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

// ─── Áp dụng ma trận do AI tổng hợp (theo MÃ) ────────────────────────────────
function mapIRM(s?: string): "I" | "R" | "M" {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "2" || v === "T" || v.startsWith("R")) return "R";
  if (v === "3" || v === "U" || v.startsWith("M")) return "M";
  return "I";
}

// Item lỗi/cắt cụt -> trả về object rỗng (.catch) để KHÔNG làm hỏng cả mảng;
// các item mã rỗng sẽ bị bỏ qua ở applyMatrixMappings / lọc theo PLO.
const ploCourseItem = z
  .object({ courseCode: z.string(), ploCode: z.string(), level: z.string().optional() })
  .catch({ courseCode: "", ploCode: "" });
const cloPloItem = z
  .object({ courseCode: z.string(), cloCode: z.string(), ploCode: z.string() })
  .catch({ courseCode: "", cloCode: "", ploCode: "" });

export const matrixDraftSchema = z.object({
  ploCourse: z.array(ploCourseItem).default([]),
  cloPlo: z.array(cloPloItem).default([]),
});
export type MatrixDraft = z.infer<typeof matrixDraftSchema>;

/** Tìm học phần theo mã: trim + KHÔNG phân biệt hoa thường (AI có thể trả "tmae306 " v.v.). */
async function findCourseByCode(code: string) {
  const c = code.trim();
  if (!c) return null;
  return prisma.course.findFirst({ where: { code: { equals: c, mode: "insensitive" }, deletedAt: null } });
}

/** Ghi ma trận đã DUYỆT (PLO×học phần I/R/M + CLO–PLO) theo mã, trong phạm vi 1 phiên bản CTĐT. */
export async function applyMatrixMappings(programmeVersionId: string, input: MatrixDraft) {
  const data = matrixDraftSchema.parse(input);
  const res = { ploCourse: 0, cloPlo: 0, errors: [] as string[] };

  const ploByCode = new Map(
    (await prisma.programmeLearningOutcome.findMany({ where: { programmeVersionId } })).map((p) => [p.code.toUpperCase(), p.id]),
  );

  for (const m of data.ploCourse) {
    const ploId = ploByCode.get(m.ploCode.trim().toUpperCase());
    if (!ploId) { res.errors.push(`Bỏ qua: không có ${m.ploCode} trong phiên bản này`); continue; }
    const course = await findCourseByCode(m.courseCode);
    if (!course) { res.errors.push(`Bỏ qua: không tìm thấy học phần ${m.courseCode}`); continue; }
    await prisma.ploCourseMapping.upsert({
      where: { ploId_courseId: { ploId, courseId: course.id } },
      update: { level: mapIRM(m.level) },
      create: withTenantId({ ploId, courseId: course.id, level: mapIRM(m.level) }),
    });
    res.ploCourse++;
  }

  for (const m of data.cloPlo) {
    const ploId = ploByCode.get(m.ploCode.trim().toUpperCase());
    if (!ploId) continue;
    const course = await findCourseByCode(m.courseCode);
    if (!course) continue;
    const clo = await prisma.courseLearningOutcome.findFirst({ where: { courseId: course.id, code: m.cloCode } });
    if (!clo) continue;
    await prisma.cloPloMapping.upsert({
      where: { cloId_ploId: { cloId: clo.id, ploId } },
      update: {},
      create: withTenantId({ cloId: clo.id, ploId }),
    });
    res.cloPlo++;
  }

  await writeAudit({ action: "matrix.apply_ai", entity: "PloCourseMapping", meta: { ...res, errors: res.errors.length } });
  return res;
}
