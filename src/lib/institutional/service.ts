import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

// ─── Đội ngũ giảng viên (C5) ────────────────────────────────────────────────
export const academicStaffSchema = z.object({
  fullName: z.string().min(1),
  academicRank: z.string().optional(),
  degree: z.string().optional(),
  specialization: z.string().optional(),
  position: z.string().optional(),
  publications: z.number().int().min(0).default(0),
  note: z.string().optional(),
});

export async function listAcademicStaff(p: PageParams) {
  const where = p.search ? { fullName: { contains: p.search, mode: "insensitive" as const } } : {};
  const [items, total] = await Promise.all([
    prisma.academicStaff.findMany({ where, orderBy: { fullName: "asc" }, skip: p.skip, take: p.take }),
    prisma.academicStaff.count({ where }),
  ]);
  return paginated(items, total, p);
}
export async function createAcademicStaff(input: z.infer<typeof academicStaffSchema>) {
  const ctx = requireTenantContext();
  const row = await prisma.academicStaff.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "staff.create", entity: "AcademicStaff", entityId: row.id });
  return row;
}

// ─── Người học & dịch vụ hỗ trợ (C6) ────────────────────────────────────────
export const studentServiceSchema = z.object({
  category: z.enum(["admission", "advising", "scholarship", "internship", "career", "extracurricular", "support"]),
  title: z.string().min(1),
  description: z.string().optional(),
  academicYear: z.string().optional(),
  metricValue: z.number().optional(),
  note: z.string().optional(),
});

export async function listStudentServices(p: PageParams) {
  const where = p.search ? { title: { contains: p.search, mode: "insensitive" as const } } : {};
  const [items, total] = await Promise.all([
    prisma.studentService.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
    prisma.studentService.count({ where }),
  ]);
  return paginated(items, total, p);
}
export async function createStudentService(input: z.infer<typeof studentServiceSchema>) {
  const ctx = requireTenantContext();
  const row = await prisma.studentService.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "student_service.create", entity: "StudentService", entityId: row.id });
  return row;
}

// ─── Cơ sở vật chất (C7) ────────────────────────────────────────────────────
export const facilitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["classroom", "lab", "library", "it", "software", "equipment", "space"]),
  code: z.string().optional(),
  quantity: z.number().int().optional(),
  capacity: z.number().int().optional(),
  location: z.string().optional(),
  note: z.string().optional(),
});

export async function listFacilities(p: PageParams) {
  const where = p.search ? { name: { contains: p.search, mode: "insensitive" as const } } : {};
  const [items, total] = await Promise.all([
    prisma.facility.findMany({ where, orderBy: { name: "asc" }, skip: p.skip, take: p.take }),
    prisma.facility.count({ where }),
  ]);
  return paginated(items, total, p);
}
export async function createFacility(input: z.infer<typeof facilitySchema>) {
  const ctx = requireTenantContext();
  const row = await prisma.facility.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "facility.create", entity: "Facility", entityId: row.id });
  return row;
}

// ─── Kết quả đầu ra / outcomes (C8) ─────────────────────────────────────────
export const outcomeSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["graduation", "employment", "satisfaction", "plo_attainment", "research", "other"]),
  academicYear: z.string().optional(),
  value: z.number().optional(),
  unit: z.string().optional(),
  note: z.string().optional(),
});

export async function listOutcomes(p: PageParams) {
  const where = p.search ? { name: { contains: p.search, mode: "insensitive" as const } } : {};
  const [items, total] = await Promise.all([
    prisma.outcomeMetric.findMany({ where, orderBy: { academicYear: "desc" }, skip: p.skip, take: p.take }),
    prisma.outcomeMetric.count({ where }),
  ]);
  return paginated(items, total, p);
}
export async function createOutcome(input: z.infer<typeof outcomeSchema>) {
  const ctx = requireTenantContext();
  const row = await prisma.outcomeMetric.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "outcome.create", entity: "OutcomeMetric", entityId: row.id });
  return row;
}

// ─── Xóa mềm chung ──────────────────────────────────────────────────────────
type InstModel = "academicStaff" | "studentService" | "facility" | "outcomeMetric";
export async function softDeleteInstitutional(model: InstModel, id: string) {
  const ctx = requireTenantContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[model];
  const row = await delegate.findFirst({ where: { id } });
  if (!row) throw notFound("Bản ghi không tồn tại");
  await delegate.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: `${model}.delete`, entity: model, entityId: id });
}
