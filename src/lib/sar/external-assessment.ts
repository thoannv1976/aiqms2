import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";

export const EXTERNAL_STATUSES = ["planned", "onsite", "completed"] as const;

export const createExternalSchema = z.object({
  sarId: z.string().min(1),
  title: z.string().min(1),
  assessorNames: z.string().optional(),
  siteVisitStart: z.coerce.date().optional(),
  siteVisitEnd: z.coerce.date().optional(),
});

export async function createExternalAssessment(input: z.infer<typeof createExternalSchema>) {
  const ctx = requireTenantContext();
  const sar = await prisma.selfAssessmentReport.findFirst({ where: { id: input.sarId } });
  if (!sar) throw badRequest("SAR không tồn tại");
  const row = await prisma.externalAssessment.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "external.create", entity: "ExternalAssessment", entityId: row.id });
  return row;
}

export async function listExternalAssessments(sarId: string) {
  return prisma.externalAssessment.findMany({
    where: { sarId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scores: true } } },
  });
}

/** Chi tiết đợt ĐGN: kèm điểm theo tiêu chí (gắn thông tin tiêu chí global). */
export async function getExternalAssessment(id: string) {
  const a = await prisma.externalAssessment.findFirst({ where: { id }, include: { scores: true, sar: true } });
  if (!a) throw notFound("Đợt đánh giá ngoài không tồn tại");
  const criteria = await prisma.criterion.findMany({
    where: { standardVersionId: a.sar.standardVersionId },
    orderBy: { order: "asc" },
  });
  const scoreByCrit = new Map(a.scores.map((s) => [s.criterionId, s]));
  const rows = criteria.map((c) => ({
    criterionId: c.id, code: c.code, titleVi: c.titleVi,
    score: scoreByCrit.get(c.id)?.score ?? null,
    strengths: scoreByCrit.get(c.id)?.strengths ?? null,
    areasForImprovement: scoreByCrit.get(c.id)?.areasForImprovement ?? null,
  }));
  return { ...a, criteria: rows };
}

export const externalScoreSchema = z.object({
  criterionId: z.string().min(1),
  score: z.coerce.number().int().min(1).max(7).nullable().optional(),
  strengths: z.string().nullable().optional(),
  areasForImprovement: z.string().nullable().optional(),
});

export async function setExternalScore(assessmentId: string, input: z.infer<typeof externalScoreSchema>) {
  const ctx = requireTenantContext();
  const a = await prisma.externalAssessment.findFirst({ where: { id: assessmentId } });
  if (!a) throw notFound("Đợt đánh giá ngoài không tồn tại");
  const s = await prisma.externalAssessmentScore.upsert({
    where: { externalAssessmentId_criterionId: { externalAssessmentId: assessmentId, criterionId: input.criterionId } },
    update: { score: input.score ?? null, strengths: input.strengths ?? null, areasForImprovement: input.areasForImprovement ?? null, updatedBy: ctx.actorId },
    create: withTenantId({ externalAssessmentId: assessmentId, criterionId: input.criterionId, score: input.score ?? null, strengths: input.strengths ?? null, areasForImprovement: input.areasForImprovement ?? null }),
  });
  // Cập nhật điểm tổng thể (TB các tiêu chí đã chấm).
  const scores = await prisma.externalAssessmentScore.findMany({ where: { externalAssessmentId: assessmentId, score: { not: null } } });
  const overall = scores.length ? Math.round((scores.reduce((acc, x) => acc + (x.score ?? 0), 0) / scores.length) * 100) / 100 : null;
  await prisma.externalAssessment.update({ where: { id: assessmentId }, data: { overallScore: overall } });
  await writeAudit({ action: "external.score", entity: "ExternalAssessmentScore", entityId: s.id });
  return s;
}

export const updateExternalSchema = z.object({
  status: z.enum(EXTERNAL_STATUSES).optional(),
  decision: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  assessorNames: z.string().nullable().optional(),
  siteVisitStart: z.coerce.date().nullable().optional(),
  siteVisitEnd: z.coerce.date().nullable().optional(),
});

export async function updateExternalAssessment(id: string, input: z.infer<typeof updateExternalSchema>) {
  const ctx = requireTenantContext();
  const a = await prisma.externalAssessment.findFirst({ where: { id } });
  if (!a) throw notFound("Đợt đánh giá ngoài không tồn tại");
  const updated = await prisma.externalAssessment.update({ where: { id }, data: { ...input, updatedBy: ctx.actorId } });
  await writeAudit({ action: "external.update", entity: "ExternalAssessment", entityId: id });
  return updated;
}

export async function deleteExternalAssessment(id: string) {
  const ctx = requireTenantContext();
  const a = await prisma.externalAssessment.findFirst({ where: { id } });
  if (!a) throw notFound("Đợt đánh giá ngoài không tồn tại");
  await prisma.externalAssessment.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "external.delete", entity: "ExternalAssessment", entityId: id });
}
