import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { writeAudit } from "@/lib/audit/log";
import { badRequest, notFound } from "@/lib/http/responses";

/** Danh sách bộ tiêu chuẩn + phiên bản đang áp dụng. */
export async function listStandards() {
  const standards = await prisma.accreditationStandard.findMany({
    orderBy: { code: "asc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, name: true, isActive: true },
      },
    },
  });
  return standards.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    level: s.level,
    versions: s.versions,
    activeVersion: s.versions.find((v) => v.isActive) ?? null,
  }));
}

/** Chi tiết bộ tiêu chuẩn + tiêu chí/yêu cầu của phiên bản (mặc định phiên bản active). */
export async function getStandard(id: string, versionId?: string) {
  const standard = await prisma.accreditationStandard.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!standard) throw notFound("Bộ tiêu chuẩn không tồn tại");

  const version =
    standard.versions.find((v) => v.id === versionId) ??
    standard.versions.find((v) => v.isActive) ??
    standard.versions[0];

  const criteria = version
    ? await prisma.criterion.findMany({
        where: { standardVersionId: version.id },
        orderBy: { order: "asc" },
        include: {
          requirements: { orderBy: { order: "asc" } },
          suggestedEvidences: true,
        },
      })
    : [];

  const ratingScale = version
    ? await prisma.ratingScale.findMany({
        where: { standardVersionId: version.id },
        orderBy: { level: "asc" },
      })
    : [];

  return {
    id: standard.id,
    code: standard.code,
    name: standard.name,
    level: standard.level,
    versions: standard.versions.map((v) => ({
      id: v.id,
      version: v.version,
      isActive: v.isActive,
    })),
    selectedVersion: version ? { id: version.id, version: version.version } : null,
    criteria,
    ratingScale,
  };
}

// ─── Cấu hình (super-admin) — thêm chuẩn mới KHÔNG cần sửa code lõi ──────────
export const createStandardSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  level: z.enum(["programme", "institution"]).default("programme"),
  version: z.string().min(1).default("1.0"),
  activate: z.boolean().default(true),
});

export async function createStandard(input: z.infer<typeof createStandardSchema>) {
  const dup = await prisma.accreditationStandard.findUnique({ where: { code: input.code } });
  if (dup) throw badRequest("Mã bộ tiêu chuẩn đã tồn tại", "code_taken");
  const standard = await prisma.accreditationStandard.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      level: input.level,
      versions: {
        create: { version: input.version, isActive: input.activate, name: `${input.name} v${input.version}` },
      },
    },
    include: { versions: true },
  });
  await writeAudit({ action: "standard.create", entity: "AccreditationStandard", entityId: standard.id });
  return standard;
}

export const createCriterionSchema = z.object({
  standardVersionId: z.string().min(1),
  code: z.string().min(1),
  order: z.number().int().positive(),
  titleVi: z.string().min(1),
  titleEn: z.string().optional(),
  description: z.string().optional(),
});

export async function createCriterion(input: z.infer<typeof createCriterionSchema>) {
  const version = await prisma.standardVersion.findUnique({ where: { id: input.standardVersionId } });
  if (!version) throw badRequest("Phiên bản tiêu chuẩn không tồn tại");
  const criterion = await prisma.criterion.create({ data: input });
  await writeAudit({ action: "criterion.create", entity: "Criterion", entityId: criterion.id });
  return criterion;
}

export const createRequirementSchema = z.object({
  criterionId: z.string().min(1),
  code: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  guidance: z.string().optional(),
});

export async function createRequirement(input: z.infer<typeof createRequirementSchema>) {
  const criterion = await prisma.criterion.findUnique({ where: { id: input.criterionId } });
  if (!criterion) throw badRequest("Tiêu chí không tồn tại");
  const req = await prisma.requirement.create({ data: input });
  await writeAudit({ action: "requirement.create", entity: "Requirement", entityId: req.id });
  return req;
}
