import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { getStorage, tenantKey } from "@/lib/storage";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

export const createEvidenceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  providerUnit: z.string().optional(),
  programmeId: z.string().optional(),
  academicYear: z.string().optional(),
  criterionIds: z.array(z.string()).default([]),
  requirementIds: z.array(z.string()).default([]),
});

/** Tự đánh mã minh chứng MC-XXXX theo tenant. */
async function nextCode(): Promise<string> {
  const count = await prisma.evidence.count();
  return `MC-${String(count + 1).padStart(4, "0")}`;
}

export async function createEvidence(input: z.infer<typeof createEvidenceSchema>) {
  const ctx = requireTenantContext();
  const { criterionIds, requirementIds, ...rest } = input;

  // Thử tối đa vài lần phòng đụng mã (unique theo tenant).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await nextCode();
    try {
      const evidence = await prisma.evidence.create({
        data: withTenantId({
          ...rest,
          code,
          createdBy: ctx.actorId,
          criteria: { create: criterionIds.map((criterionId) => withTenantId({ criterionId })) },
          requirements: { create: requirementIds.map((requirementId) => withTenantId({ requirementId })) },
        }),
        include: { criteria: true, requirements: true },
      });
      await writeAudit({ action: "evidence.create", entity: "Evidence", entityId: evidence.id });
      return evidence;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }
  throw badRequest("Không sinh được mã minh chứng, thử lại");
}

export async function listEvidence(
  p: PageParams,
  filters: { criterionId?: string; academicYear?: string; status?: string } = {},
) {
  const where: Prisma.EvidenceWhereInput = {};
  if (p.search) {
    where.OR = [
      { title: { contains: p.search, mode: "insensitive" } },
      { code: { contains: p.search, mode: "insensitive" } },
    ];
  }
  if (filters.academicYear) where.academicYear = filters.academicYear;
  if (filters.status) where.status = filters.status;
  if (filters.criterionId) where.criteria = { some: { criterionId: filters.criterionId } };

  const [items, total] = await Promise.all([
    prisma.evidence.findMany({
      where,
      orderBy: { code: "asc" },
      skip: p.skip,
      take: p.take,
      include: { files: true, criteria: true, _count: { select: { files: true } } },
    }),
    prisma.evidence.count({ where }),
  ]);
  return paginated(items, total, p);
}

export async function getEvidence(id: string) {
  const ev = await prisma.evidence.findFirst({
    where: { id },
    include: { files: true, links: true, criteria: true, requirements: true, verifications: { orderBy: { createdAt: "desc" } } },
  });
  if (!ev) throw notFound("Minh chứng không tồn tại");
  return ev;
}

/** Upload một file vào minh chứng. Tính hash chống trùng + lưu qua lớp Storage. */
export async function addFile(
  evidenceId: string,
  file: { fileName: string; body: Buffer; contentType?: string },
) {
  const ctx = requireTenantContext();
  const ev = await prisma.evidence.findFirst({ where: { id: evidenceId } });
  if (!ev) throw notFound("Minh chứng không tồn tại");

  const hash = createHash("sha256").update(file.body).digest("hex");
  const duplicate = await prisma.evidenceFile.findFirst({ where: { hash } });

  const key = tenantKey(ctx.tenantId, "evidence", evidenceId, `${hash}-${file.fileName}`);
  await getStorage().put(key, file.body, { contentType: file.contentType });

  const record = await prisma.evidenceFile.create({
    data: withTenantId({
      evidenceId,
      fileName: file.fileName,
      storageKey: key,
      size: file.body.byteLength,
      contentType: file.contentType,
      hash,
    }),
  });
  await writeAudit({ action: "evidence.file.add", entity: "EvidenceFile", entityId: record.id });
  return { file: record, duplicateOf: duplicate?.evidenceId ?? null };
}

export const verifySchema = z.object({
  toStatus: z.enum(["pending", "valid", "needs_more", "invalid"]),
  note: z.string().optional(),
});

export async function verifyEvidence(id: string, input: z.infer<typeof verifySchema>) {
  const ctx = requireTenantContext();
  const ev = await prisma.evidence.findFirst({ where: { id } });
  if (!ev) throw notFound("Minh chứng không tồn tại");
  const updated = await prisma.evidence.update({
    where: { id },
    data: { status: input.toStatus, note: input.note, updatedBy: ctx.actorId },
  });
  await prisma.evidenceVerificationLog.create({
    data: withTenantId({
      evidenceId: id,
      fromStatus: ev.status,
      toStatus: input.toStatus,
      note: input.note,
      actorId: ctx.actorId,
    }),
  });
  await writeAudit({ action: "evidence.verify", entity: "Evidence", entityId: id, meta: { to: input.toStatus } });
  return updated;
}

export async function mapCriterion(evidenceId: string, criterionId: string) {
  const ev = await prisma.evidence.findFirst({ where: { id: evidenceId } });
  if (!ev) throw notFound("Minh chứng không tồn tại");
  return prisma.evidenceCriterionMapping.upsert({
    where: { evidenceId_criterionId: { evidenceId, criterionId } },
    update: {},
    create: withTenantId({ evidenceId, criterionId }),
  });
}

export async function deleteEvidence(id: string) {
  const ctx = requireTenantContext();
  const ev = await prisma.evidence.findFirst({ where: { id } });
  if (!ev) throw notFound("Minh chứng không tồn tại");
  // Soft-delete: tài liệu minh chứng không xóa cứng.
  await prisma.evidence.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "evidence.delete", entity: "Evidence", entityId: id });
}
