import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";

export const attainmentSchema = z.object({
  ploId: z.string().min(1),
  cohort: z.string().optional(),
  term: z.string().optional(),
  attainmentRate: z.coerce.number().min(0).max(100),
  sampleSize: z.coerce.number().int().nonnegative().optional(),
  target: z.coerce.number().min(0).max(100).optional(),
  method: z.string().optional(),
  note: z.string().optional(),
});

export async function listAttainments(programmeVersionId: string) {
  const rows = await prisma.ploAttainment.findMany({
    where: { programmeVersionId, deletedAt: null },
    orderBy: [{ ploId: "asc" }, { createdAt: "desc" }],
    include: { plo: { select: { code: true, description: true } } },
  });
  return rows;
}

export async function createAttainment(programmeVersionId: string, input: z.infer<typeof attainmentSchema>) {
  const ctx = requireTenantContext();
  const plo = await prisma.programmeLearningOutcome.findFirst({ where: { id: input.ploId, programmeVersionId } });
  if (!plo) throw badRequest("PLO không thuộc phiên bản CTĐT này");
  const row = await prisma.ploAttainment.create({
    data: withTenantId({ ...input, programmeVersionId, createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "plo.attainment.create", entity: "PloAttainment", entityId: row.id });
  return row;
}

export async function deleteAttainment(id: string) {
  const ctx = requireTenantContext();
  const row = await prisma.ploAttainment.findFirst({ where: { id } });
  if (!row) throw notFound("Bản ghi mức đạt PLO không tồn tại");
  await prisma.ploAttainment.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "plo.attainment.delete", entity: "PloAttainment", entityId: id });
}

/**
 * Tổng hợp mức đạt PLO trung bình (theo từng PLO) và đưa vào C8 (D7):
 * tạo/cập nhật một OutcomeMetric (category=plo_attainment) cho mỗi PLO có dữ liệu.
 * Idempotent theo dataSource = plo_attainment:<ploId>.
 */
export async function promoteAttainmentsToOutcomes(programmeVersionId: string) {
  const ctx = requireTenantContext();
  const rows = await prisma.ploAttainment.findMany({
    where: { programmeVersionId, deletedAt: null },
    include: { plo: { select: { code: true } } },
  });
  if (rows.length === 0) throw badRequest("Chưa có dữ liệu mức đạt PLO để tổng hợp");

  // Gộp theo PLO.
  const byPlo = new Map<string, { code: string; rates: number[]; target?: number }>();
  for (const r of rows) {
    const e = byPlo.get(r.ploId) ?? { code: r.plo.code, rates: [], target: r.target ?? undefined };
    e.rates.push(r.attainmentRate);
    if (r.target != null) e.target = r.target;
    byPlo.set(r.ploId, e);
  }

  let created = 0;
  let updated = 0;
  for (const [ploId, e] of byPlo) {
    const avg = Math.round((e.rates.reduce((a, b) => a + b, 0) / e.rates.length) * 100) / 100;
    const dataSource = `plo_attainment:${ploId}`;
    const data = {
      name: `Mức đạt ${e.code}`,
      category: "plo_attainment",
      value: avg,
      unit: "%",
      target: e.target ?? null,
      dataSource,
      note: `Trung bình ${e.rates.length} lần đo`,
    };
    const existing = await prisma.outcomeMetric.findFirst({ where: { dataSource, deletedAt: null } });
    if (existing) {
      await prisma.outcomeMetric.update({ where: { id: existing.id }, data: { ...data, updatedBy: ctx.actorId } });
      updated++;
    } else {
      await prisma.outcomeMetric.create({ data: withTenantId({ ...data, createdBy: ctx.actorId }) });
      created++;
    }
  }
  await writeAudit({ action: "plo.attainment.to_outcome", entity: "ProgrammeVersion", entityId: programmeVersionId, meta: { created, updated } });
  return { ploCount: byPlo.size, created, updated };
}
