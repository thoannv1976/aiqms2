import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { getStorage, safePut, storageMissingError, storageStatus, tenantKey } from "@/lib/storage";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";
import { addFile, createEvidence } from "@/lib/evidence/service";

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
  // Chỉ hiển thị bản hiện hành của mỗi chuỗi phiên bản (D10); bản cũ xem qua lịch sử.
  const where: Prisma.DocumentWhereInput = { isCurrent: true };
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

/**
 * Kho ĐỀ CƯƠNG (category=syllabus) giàu thông tin để quản lý & kiểm định AUN-QA:
 * mã học phần đã trích xuất (courseId), dung lượng, ngày upload, phiên bản, nơi lưu (bền vững?).
 */
export async function listSyllabusRepo(programmeId?: string) {
  const where: Prisma.DocumentWhereInput = { category: "syllabus", deletedAt: null, isCurrent: true };
  if (programmeId) where.programmeId = programmeId;
  const docs = await prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });

  const courseIds = [...new Set(docs.map((d) => d.courseId).filter((v): v is string => !!v))];
  const courses = courseIds.length
    ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, code: true, name: true } })
    : [];
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const items = docs.map((d) => {
    const course = d.courseId ? courseById.get(d.courseId) ?? null : null;
    return {
      id: d.id, title: d.title, fileName: d.fileName, size: d.size,
      contentType: d.contentType, createdAt: d.createdAt, version: d.version,
      programmeId: d.programmeId, note: d.note,
      extracted: !!course, courseCode: course?.code ?? null, courseName: course?.name ?? null,
    };
  });
  return {
    items,
    total: items.length,
    extractedCount: items.filter((i) => i.extracted).length,
    storage: storageStatus(),
  };
}

/**
 * Dọn các đề cương "mồ côi" (bản ghi còn nhưng FILE ĐÃ MẤT khỏi kho — vd /tmp Cloud Run bị xóa).
 * Kiểm tra từng file bằng storage.exists; file không còn → xóa mềm để danh sách chỉ hiện đề cương
 * thực sự còn lưu trữ. Trả về số đã kiểm tra / số đã dọn.
 */
export async function cleanupMissingSyllabi(programmeId?: string) {
  const ctx = requireTenantContext();
  const where: Prisma.DocumentWhereInput = { category: "syllabus", deletedAt: null, isCurrent: true };
  if (programmeId) where.programmeId = programmeId;
  const docs = await prisma.document.findMany({ where, select: { id: true, storageKey: true, title: true } });
  const storage = getStorage();
  const removed: string[] = [];
  for (const d of docs) {
    const exists = await storage.exists(d.storageKey).catch(() => false);
    if (!exists) {
      await prisma.document.update({ where: { id: d.id }, data: softDeleteData(ctx.actorId) });
      removed.push(d.title);
    }
  }
  await writeAudit({ action: "document.cleanup_missing", entity: "Document", meta: { checked: docs.length, removed: removed.length } });
  return { checked: docs.length, removed: removed.length };
}

export async function getDocument(id: string) {
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  return doc;
}

export async function downloadDocument(id: string) {
  const doc = await getDocument(id);
  const body = await getStorage().get(doc.storageKey);
  if (!body) throw storageMissingError();
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

/**
 * Tải lên PHIÊN BẢN MỚI của một tài liệu (D10): tạo bản ghi mới cùng chuỗi (rootId),
 * tăng version, đánh dấu bản mới là hiện hành và hạ cờ các bản cũ trong chuỗi.
 * Giữ nguyên metadata gắn kết (category/CTĐT/học phần/task) trừ khi truyền mới.
 */
export async function uploadNewVersion(
  documentId: string,
  file: { fileName: string; body: Buffer; contentType?: string },
  overrides: { title?: string; note?: string } = {},
) {
  const ctx = requireTenantContext();
  if (!file.body.byteLength) throw badRequest("File rỗng");
  const base = await prisma.document.findFirst({ where: { id: documentId } });
  if (!base) throw notFound("Tài liệu không tồn tại");
  const rootId = base.rootId ?? base.id;

  // Version kế tiếp = max(version) trong chuỗi + 1.
  const agg = await prisma.document.aggregate({
    where: { OR: [{ id: rootId }, { rootId }] },
    _max: { version: true },
  });
  const nextVersion = (agg._max.version ?? base.version) + 1;

  const key = tenantKey(ctx.tenantId, "documents", `${Date.now()}-${file.fileName}`);
  await safePut(key, file.body, { contentType: file.contentType });

  const doc = await prisma.document.create({
    data: withTenantId({
      title: overrides.title ?? base.title,
      category: base.category,
      programmeId: base.programmeId,
      courseId: base.courseId,
      taskId: base.taskId,
      note: overrides.note ?? base.note,
      fileName: file.fileName,
      storageKey: key,
      size: file.body.byteLength,
      contentType: file.contentType ?? null,
      version: nextVersion,
      rootId,
      isCurrent: true,
      createdBy: ctx.actorId,
    }),
  });
  // Hạ cờ hiện hành của tất cả bản còn lại trong chuỗi.
  await prisma.document.updateMany({
    where: { OR: [{ id: rootId }, { rootId }], id: { not: doc.id } },
    data: { isCurrent: false },
  });
  await writeAudit({ action: "document.new_version", entity: "Document", entityId: doc.id, meta: { rootId, version: nextVersion } });
  return doc;
}

/** Liệt kê toàn bộ phiên bản của một tài liệu (theo chuỗi rootId), mới nhất trước. */
export async function listDocumentVersions(documentId: string) {
  const doc = await prisma.document.findFirst({ where: { id: documentId } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  const rootId = doc.rootId ?? doc.id;
  return prisma.document.findMany({
    where: { OR: [{ id: rootId }, { rootId }], deletedAt: null },
    orderBy: { version: "desc" },
  });
}

export async function deleteDocument(id: string) {
  const ctx = requireTenantContext();
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  await prisma.document.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "document.delete", entity: "Document", entityId: id });
}

/**
 * Đưa một tài liệu (vd file nộp ở task) vào HỒ SƠ MINH CHỨNG chính thức: tạo Evidence
 * (tự sinh mã MC-XXXX), gắn tiêu chí của công việc (nếu có), đính kèm chính file đó.
 */
export async function promoteDocumentToEvidence(documentId: string) {
  const ctx = requireTenantContext();
  const doc = await prisma.document.findFirst({ where: { id: documentId } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  const bytes = await getStorage().get(doc.storageKey);
  if (!bytes) throw storageMissingError();

  // Tiêu chí lấy từ công việc gắn với tài liệu (nếu có).
  let criterionIds: string[] = [];
  if (doc.taskId) {
    const task = await prisma.task.findFirst({ where: { id: doc.taskId }, select: { criterionId: true } });
    if (task?.criterionId) criterionIds = [task.criterionId];
  }

  const evidence = await createEvidence({
    title: doc.title || doc.fileName,
    academicYear: undefined,
    criterionIds,
    requirementIds: [],
  });
  await addFile(evidence.id, { fileName: doc.fileName, body: bytes, contentType: doc.contentType ?? undefined });

  // Đánh dấu tài liệu đã đưa vào hồ sơ (ghi chú).
  await prisma.document.update({ where: { id: documentId }, data: { note: `Đã đưa vào hồ sơ minh chứng: ${evidence.code}`, updatedBy: ctx.actorId } });
  await writeAudit({ action: "document.to_evidence", entity: "Evidence", entityId: evidence.id, meta: { documentId } });
  return { evidenceId: evidence.id, code: evidence.code };
}
