import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { getStorage, safePut, tenantKey } from "@/lib/storage";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

export const DOCUMENT_CATEGORIES = [
  "ctdt_source", // file CTĐT gốc (Word)
  "syllabus", // file đề cương học phần (gắn courseId)
  "regulation", // quy chế / quy định
  "template", // biểu mẫu
  "report", // báo cáo
  "task_evidence", // minh chứng nộp cho một công việc (gắn taskId)
  "other",
] as const;

export const DOC_CATEGORY_LABELS: Record<string, string> = {
  ctdt_source: "CTĐT gốc",
  syllabus: "Đề cương học phần",
  regulation: "Quy chế / quy định",
  template: "Biểu mẫu",
  report: "Báo cáo",
  task_evidence: "Minh chứng công việc",
  other: "Khác",
};

export const createDocumentSchema = z.object({
  title: z.string().min(1),
  category: z.enum(DOCUMENT_CATEGORIES).default("other"),
  programmeId: z.string().optional(),
  courseId: z.string().optional(),
  taskId: z.string().optional(),
  note: z.string().optional(),
});

/** Lưu một file vào kho tài liệu (qua lớp Storage — GCS/S3 ở prod). */
export async function createDocument(
  meta: z.infer<typeof createDocumentSchema>,
  file: { fileName: string; body: Buffer; contentType?: string },
) {
  const ctx = requireTenantContext();
  if (!file.body.byteLength) throw badRequest("File rỗng");
  const key = tenantKey(ctx.tenantId, "documents", `${Date.now()}-${file.fileName}`);
  await safePut(key, file.body, { contentType: file.contentType });

  const doc = await prisma.document.create({
    data: withTenantId({
      title: meta.title || file.fileName,
      category: meta.category,
      programmeId: meta.programmeId ?? null,
      courseId: meta.courseId ?? null,
      taskId: meta.taskId ?? null,
      note: meta.note ?? null,
      fileName: file.fileName,
      storageKey: key,
      size: file.body.byteLength,
      contentType: file.contentType ?? null,
      createdBy: ctx.actorId,
    }),
  });
  await writeAudit({ action: "document.create", entity: "Document", entityId: doc.id, meta: { category: meta.category } });
  return doc;
}

export async function listDocuments(
  p: PageParams,
  filters: { category?: string; programmeId?: string; courseId?: string; taskId?: string } = {},
) {
  const where: Prisma.DocumentWhereInput = {};
  if (p.search) where.title = { contains: p.search, mode: "insensitive" };
  if (filters.category) where.category = filters.category;
  if (filters.programmeId) where.programmeId = filters.programmeId;
  if (filters.courseId) where.courseId = filters.courseId;
  if (filters.taskId) where.taskId = filters.taskId;
  const [items, total] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
    prisma.document.count({ where }),
  ]);
  return paginated(items, total, p);
}

export async function getDocument(id: string) {
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  return doc;
}

export async function downloadDocument(id: string) {
  const doc = await getDocument(id);
  const body = await getStorage().get(doc.storageKey);
  if (!body) throw notFound("File không tồn tại trong kho lưu trữ");
  return { body, fileName: doc.fileName, contentType: doc.contentType ?? "application/octet-stream" };
}

/** Gắn tài liệu với học phần/CTĐT (vd sau khi apply import đề cương). */
export async function linkDocument(id: string, link: { courseId?: string; programmeId?: string }) {
  const ctx = requireTenantContext();
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  return prisma.document.update({
    where: { id },
    data: {
      courseId: link.courseId ?? doc.courseId,
      programmeId: link.programmeId ?? doc.programmeId,
      updatedBy: ctx.actorId,
    },
  });
}

export async function deleteDocument(id: string) {
  const ctx = requireTenantContext();
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  await prisma.document.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "document.delete", entity: "Document", entityId: id });
}
