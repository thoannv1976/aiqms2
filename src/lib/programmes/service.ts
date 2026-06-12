import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

export const createProgrammeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  level: z.enum(["bachelor", "master", "doctor"]).default("bachelor"),
  totalCredits: z.number().int().positive().optional(),
  facultyId: z.string().optional(),
  initialVersion: z.string().default("2024"),
});

export async function listProgrammes(p: PageParams) {
  const where: Prisma.ProgrammeWhereInput = { deletedAt: null };
  if (p.search) {
    where.OR = [
      { code: { contains: p.search, mode: "insensitive" } },
      { name: { contains: p.search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.programme.findMany({
      where,
      orderBy: { code: "asc" },
      skip: p.skip,
      take: p.take,
      include: { versions: { select: { id: true, version: true, status: true } } },
    }),
    prisma.programme.count({ where }),
  ]);

  // Làm giàu: người tạo + số học phần + số PLO (đã số hóa CTĐT chưa).
  const progIds = items.map((p) => p.id);
  const versionIds = items.flatMap((p) => p.versions.map((v) => v.id));
  const creatorIds = [...new Set(items.map((p) => p.createdBy).filter((v): v is string => !!v))];
  const [users, courseGroups, ploGroups] = await Promise.all([
    creatorIds.length ? prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, fullName: true } }) : [],
    progIds.length ? prisma.course.groupBy({ by: ["programmeId"], where: { programmeId: { in: progIds }, deletedAt: null }, _count: { _all: true } }) : [],
    versionIds.length ? prisma.programmeLearningOutcome.groupBy({ by: ["programmeVersionId"], where: { programmeVersionId: { in: versionIds } }, _count: { _all: true } }) : [],
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const courseByProg = new Map(courseGroups.map((g) => [g.programmeId as string, g._count._all]));
  const ploByVersion = new Map(ploGroups.map((g) => [g.programmeVersionId, g._count._all]));
  const enriched = items.map((p) => {
    const ploCount = p.versions.reduce((n, v) => n + (ploByVersion.get(v.id) ?? 0), 0);
    const courseCount = courseByProg.get(p.id) ?? 0;
    return {
      ...p,
      createdByName: p.createdBy ? nameById.get(p.createdBy) ?? null : null,
      courseCount,
      ploCount,
      extracted: courseCount > 0 || ploCount > 0,
    };
  });
  return paginated(enriched, total, p);
}

/** Xóa mềm nhiều CTĐT cùng lúc (quản lý). */
export async function deleteProgrammesBulk(ids: string[]) {
  const ctx = requireTenantContext();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return { deleted: 0 };
  const r = await prisma.programme.updateMany({ where: { id: { in: uniq }, deletedAt: null }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "programme.bulk_delete", entity: "Programme", meta: { deleted: r.count } });
  return { deleted: r.count };
}

export async function getProgramme(id: string) {
  const prog = await prisma.programme.findFirst({
    where: { id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        include: {
          peos: { orderBy: { order: "asc" } },
          plos: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!prog) throw notFound("Chương trình không tồn tại");
  return prog;
}

export async function createProgramme(input: z.infer<typeof createProgrammeSchema>) {
  const ctx = requireTenantContext();
  const dup = await prisma.programme.findFirst({ where: { code: input.code, deletedAt: null } });
  if (dup) throw badRequest("Mã chương trình đã tồn tại", "code_taken");
  const { initialVersion, ...progData } = input;
  const prog = await prisma.programme.create({
    data: withTenantId({
      ...progData,
      createdBy: ctx.actorId,
      versions: {
        create: withTenantId({ version: initialVersion, status: "draft", createdBy: ctx.actorId }),
      },
    }),
    include: { versions: true },
  });
  await writeAudit({ action: "programme.create", entity: "Programme", entityId: prog.id });
  return prog;
}

export async function deleteProgramme(id: string) {
  const ctx = requireTenantContext();
  const prog = await prisma.programme.findFirst({ where: { id } });
  if (!prog) throw notFound("Chương trình không tồn tại");
  await prisma.programme.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "programme.delete", entity: "Programme", entityId: id });
}

// ─── Phiên bản CTĐT (vòng đời trạng thái) ───────────────────────────────────
export const createVersionSchema = z.object({
  version: z.string().min(1),
  year: z.number().int().optional(),
  educationalPhilosophy: z.string().optional(),
});

const VERSION_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "archived"],
  active: ["archived"],
  archived: [],
};

export async function createVersion(programmeId: string, input: z.infer<typeof createVersionSchema>) {
  const ctx = requireTenantContext();
  const prog = await prisma.programme.findFirst({ where: { id: programmeId } });
  if (!prog) throw notFound("Chương trình không tồn tại");
  const dup = await prisma.programmeVersion.findFirst({
    where: { programmeId, version: input.version },
  });
  if (dup) throw badRequest("Phiên bản đã tồn tại");
  const version = await prisma.programmeVersion.create({
    data: withTenantId({ ...input, programmeId, status: "draft", createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "programme_version.create", entity: "ProgrammeVersion", entityId: version.id });
  return version;
}

export async function changeVersionStatus(versionId: string, to: string) {
  const ctx = requireTenantContext();
  const v = await prisma.programmeVersion.findFirst({ where: { id: versionId } });
  if (!v) throw notFound("Phiên bản không tồn tại");
  const allowed = VERSION_TRANSITIONS[v.status] ?? [];
  if (!allowed.includes(to)) {
    throw badRequest(`Không thể chuyển trạng thái '${v.status}' -> '${to}'`, "invalid_transition");
  }
  const updated = await prisma.programmeVersion.update({
    where: { id: versionId },
    data: { status: to, updatedBy: ctx.actorId },
  });
  await writeAudit({ action: "programme_version.status", entity: "ProgrammeVersion", entityId: versionId, meta: { to } });
  return updated;
}

// ─── PEO / PLO ──────────────────────────────────────────────────────────────
export const outcomeSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().positive().default(1),
});

export async function addPeo(programmeVersionId: string, input: z.infer<typeof outcomeSchema>) {
  await ensureVersion(programmeVersionId);
  return prisma.programmeObjective.create({
    data: withTenantId({ ...input, programmeVersionId }),
  });
}

export async function addPlo(programmeVersionId: string, input: z.infer<typeof outcomeSchema>) {
  await ensureVersion(programmeVersionId);
  return prisma.programmeLearningOutcome.create({
    data: withTenantId({ ...input, programmeVersionId }),
  });
}

export async function listPlos(programmeVersionId: string) {
  return prisma.programmeLearningOutcome.findMany({
    where: { programmeVersionId },
    orderBy: { order: "asc" },
  });
}

async function ensureVersion(id: string) {
  const v = await prisma.programmeVersion.findFirst({ where: { id } });
  if (!v) throw badRequest("Phiên bản CTĐT không tồn tại");
  return v;
}
