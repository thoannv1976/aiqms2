import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { badRequest, notFound } from "@/lib/http/responses";

/** Mở phiên rà soát nội bộ cho reviewer hiện tại. */
export async function openReview(sarId: string) {
  const ctx = requireTenantContext();
  if (!ctx.actorId) throw badRequest("Thiếu reviewer");
  const sar = await prisma.selfAssessmentReport.findFirst({ where: { id: sarId } });
  if (!sar) throw notFound("SAR không tồn tại");
  const review = await prisma.internalReview.upsert({
    where: { sarId_reviewerId: { sarId, reviewerId: ctx.actorId } },
    update: {},
    create: withTenantId({ sarId, reviewerId: ctx.actorId }),
  });
  await writeAudit({ action: "review.open", entity: "InternalReview", entityId: review.id });
  return review;
}

export const scoreSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number().int().min(1).max(7),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  recommendation: z.string().optional(),
});

export async function scoreCriterion(reviewId: string, input: z.infer<typeof scoreSchema>) {
  const review = await prisma.internalReview.findFirst({ where: { id: reviewId } });
  if (!review) throw notFound("Phiên rà soát không tồn tại");
  const s = await prisma.internalReviewScore.upsert({
    where: { internalReviewId_criterionId: { internalReviewId: reviewId, criterionId: input.criterionId } },
    update: { score: input.score, strengths: input.strengths, weaknesses: input.weaknesses, recommendation: input.recommendation },
    create: withTenantId({ internalReviewId: reviewId, ...input }),
  });
  await writeAudit({ action: "review.score", entity: "InternalReviewScore", entityId: s.id });
  return s;
}

export async function submitReview(reviewId: string, summary?: string) {
  const review = await prisma.internalReview.findFirst({ where: { id: reviewId } });
  if (!review) throw notFound("Phiên rà soát không tồn tại");
  const updated = await prisma.internalReview.update({
    where: { id: reviewId },
    data: { status: "submitted", summary },
  });
  await writeAudit({ action: "review.submit", entity: "InternalReview", entityId: reviewId });
  return updated;
}

/** Tổng hợp điểm rà soát nội bộ: so sánh điểm giữa các reviewer theo tiêu chí. */
export async function aggregateScores(sarId: string) {
  const reviews = await prisma.internalReview.findMany({
    where: { sarId },
    include: { scores: true },
  });
  const byCriterion = new Map<string, number[]>();
  for (const r of reviews) {
    for (const s of r.scores) {
      const arr = byCriterion.get(s.criterionId) ?? [];
      arr.push(s.score);
      byCriterion.set(s.criterionId, arr);
    }
  }
  return [...byCriterion.entries()].map(([criterionId, scores]) => ({
    criterionId,
    reviewerCount: scores.length,
    scores,
    average: scores.reduce((a, b) => a + b, 0) / scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores),
  }));
}
