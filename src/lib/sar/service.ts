import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";
import { canTransition } from "./state";

// ─── Đợt tự đánh giá ────────────────────────────────────────────────────────
export const createCycleSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().optional(),
  standardVersionId: z.string().min(1),
  programmeId: z.string().optional(),
});

export async function createCycle(input: z.infer<typeof createCycleSchema>) {
  const ctx = requireTenantContext();
  const version = await prisma.standardVersion.findUnique({ where: { id: input.standardVersionId } });
  if (!version) throw badRequest("Phiên bản bộ tiêu chuẩn không tồn tại");
  const cycle = await prisma.assessmentCycle.create({
    data: withTenantId({ ...input, createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "cycle.create", entity: "AssessmentCycle", entityId: cycle.id });
  return cycle;
}

export async function listCycles(p: PageParams) {
  const [items, total] = await Promise.all([
    prisma.assessmentCycle.findMany({
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: { _count: { select: { reports: true } } },
    }),
    prisma.assessmentCycle.count(),
  ]);
  return paginated(items, total, p);
}

export async function getCycle(id: string) {
  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id },
    include: { reports: { orderBy: { createdAt: "desc" } } },
  });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const programme = cycle.programmeId
    ? await prisma.programme.findFirst({ where: { id: cycle.programmeId }, select: { id: true, code: true, name: true } })
    : null;
  return { ...cycle, programme };
}

export async function toggleCycleStatus(id: string) {
  const ctx = requireTenantContext();
  const c = await prisma.assessmentCycle.findFirst({ where: { id } });
  if (!c) throw notFound("Đợt tự đánh giá không tồn tại");
  const to = c.status === "open" ? "closed" : "open";
  const updated = await prisma.assessmentCycle.update({
    where: { id },
    data: { status: to, updatedBy: ctx.actorId },
  });
  await writeAudit({ action: "cycle.status", entity: "AssessmentCycle", entityId: id, meta: { to } });
  return updated;
}

// ─── SAR ────────────────────────────────────────────────────────────────────
export const createSarSchema = z.object({
  assessmentCycleId: z.string().min(1),
  programmeVersionId: z.string().min(1),
  title: z.string().min(1),
});

/** Tạo SAR và TỰ SINH response cho từng tiêu chí của bộ tiêu chuẩn áp dụng. */
export async function createSar(input: z.infer<typeof createSarSchema>) {
  const ctx = requireTenantContext();
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: input.assessmentCycleId } });
  if (!cycle) throw badRequest("Đợt tự đánh giá không tồn tại");
  const pv = await prisma.programmeVersion.findFirst({ where: { id: input.programmeVersionId } });
  if (!pv) throw badRequest("Phiên bản CTĐT không tồn tại");

  const criteria = await prisma.criterion.findMany({
    where: { standardVersionId: cycle.standardVersionId },
    orderBy: { order: "asc" },
  });
  if (criteria.length === 0) throw badRequest("Bộ tiêu chuẩn chưa có tiêu chí nào");

  const sar = await prisma.selfAssessmentReport.create({
    data: withTenantId({
      assessmentCycleId: cycle.id,
      programmeVersionId: pv.id,
      standardVersionId: cycle.standardVersionId,
      title: input.title,
      createdBy: ctx.actorId,
      responses: {
        create: criteria.map((c) =>
          withTenantId({ criterionId: c.id, status: "not_started" }),
        ),
      },
    }),
    include: { responses: true },
  });
  await writeAudit({ action: "sar.create", entity: "SelfAssessmentReport", entityId: sar.id });
  return sar;
}

export async function getSar(id: string) {
  const sar = await prisma.selfAssessmentReport.findFirst({
    where: { id },
    include: { responses: true, cycle: true },
  });
  if (!sar) throw notFound("SAR không tồn tại");
  // Đính kèm thông tin tiêu chí (global) để hiển thị.
  const criteria = await prisma.criterion.findMany({
    where: { standardVersionId: sar.standardVersionId },
    orderBy: { order: "asc" },
  });
  const byId = new Map(criteria.map((c) => [c.id, c]));
  return {
    ...sar,
    responses: sar.responses
      .map((r) => ({ ...r, criterion: byId.get(r.criterionId) ?? null }))
      .sort((a, b) => (a.criterion?.order ?? 0) - (b.criterion?.order ?? 0)),
  };
}

export async function listSars(p: PageParams) {
  const [items, total] = await Promise.all([
    prisma.selfAssessmentReport.findMany({
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: { cycle: { select: { name: true } } },
    }),
    prisma.selfAssessmentReport.count(),
  ]);
  return paginated(items, total, p);
}

export async function changeSarStatus(id: string, to: string) {
  const ctx = requireTenantContext();
  const sar = await prisma.selfAssessmentReport.findFirst({ where: { id } });
  if (!sar) throw notFound("SAR không tồn tại");
  if (!canTransition(sar.status, to)) {
    throw badRequest(`Không thể chuyển '${sar.status}' -> '${to}'`, "invalid_transition");
  }
  const updated = await prisma.selfAssessmentReport.update({
    where: { id },
    data: { status: to, updatedBy: ctx.actorId },
  });
  await writeAudit({ action: "sar.status", entity: "SelfAssessmentReport", entityId: id, meta: { from: sar.status, to } });
  return updated;
}

export async function deleteSar(id: string) {
  const ctx = requireTenantContext();
  const sar = await prisma.selfAssessmentReport.findFirst({ where: { id } });
  if (!sar) throw notFound("SAR không tồn tại");
  await prisma.selfAssessmentReport.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "sar.delete", entity: "SelfAssessmentReport", entityId: id });
}

// ─── Nhập liệu từng tiêu chí ────────────────────────────────────────────────
export const updateResponseSchema = z.object({
  currentState: z.string().optional(),
  analysis: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  improvementDone: z.string().optional(),
  improvementPlan: z.string().optional(),
  selfScore: z.number().int().optional(),
  status: z.enum(["not_started", "in_progress", "needs_more", "completed", "reviewed"]).optional(),
});

export async function updateCriterionResponse(
  responseId: string,
  input: z.infer<typeof updateResponseSchema>,
) {
  const ctx = requireTenantContext();
  const resp = await prisma.sarCriterionResponse.findFirst({
    where: { id: responseId },
    include: { sar: true },
  });
  if (!resp) throw notFound("Response tiêu chí không tồn tại");

  // Validate điểm tự đánh giá theo thang điểm của bộ tiêu chuẩn.
  if (input.selfScore !== undefined) {
    const scales = await prisma.ratingScale.findMany({
      where: { standardVersionId: resp.sar.standardVersionId },
      orderBy: { level: "asc" },
    });
    const levels = scales.map((s) => s.level);
    if (levels.length && !levels.includes(input.selfScore)) {
      throw badRequest(
        `Điểm tự đánh giá phải trong thang ${Math.min(...levels)}-${Math.max(...levels)}`,
        "score_out_of_range",
      );
    }
  }

  const updated = await prisma.sarCriterionResponse.update({
    where: { id: responseId },
    data: { ...input, updatedBy: ctx.actorId },
  });
  await writeAudit({ action: "sar.response.update", entity: "SarCriterionResponse", entityId: responseId });
  return updated;
}

// ─── Góp ý / Nhận xét SAR (rà soát cấp khoa & cấp trường) ───────────────────
export async function listSarComments(sarId: string) {
  return prisma.sarComment.findMany({
    where: { sarId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addSarComment(sarId: string, body: string, criterionId?: string) {
  const ctx = requireTenantContext();
  const sar = await prisma.selfAssessmentReport.findFirst({ where: { id: sarId } });
  if (!sar) throw notFound("SAR không tồn tại");
  const c = await prisma.sarComment.create({
    data: withTenantId({ sarId, body, criterionId: criterionId ?? null, authorId: ctx.actorId }),
  });
  await writeAudit({ action: "sar.comment", entity: "SarComment", entityId: c.id });
  return c;
}
