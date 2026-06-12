import { authedRoute } from "@/lib/http/route";
import { requirePermission, hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { prisma } from "@/lib/prisma/client";
import { parsePagination } from "@/lib/http/pagination";
import { ok, created, badRequest, forbidden } from "@/lib/http/responses";
import { createDocument, createDocumentSchema, listDocuments } from "@/lib/documents/service";

export const runtime = "nodejs";

// Danh sách tài liệu (lọc theo category/programmeId).
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const url = new URL(req.url);
  return ok(
    await listDocuments(parsePagination(req), {
      category: url.searchParams.get("category") ?? undefined,
      programmeId: url.searchParams.get("programmeId") ?? undefined,
      courseId: url.searchParams.get("courseId") ?? undefined,
      taskId: url.searchParams.get("taskId") ?? undefined,
    }),
  );
});

// Upload tài liệu (multipart/form-data: field "file" + meta title/category/note/programmeId/taskId).
export const POST = authedRoute(async (req) => {
  const ctx = requireTenantContext();
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Cần multipart/form-data");
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Thiếu file (field 'file')");

  const meta = createDocumentSchema.parse({
    title: (form.get("title") as string) || file.name,
    category: (form.get("category") as string) || "other",
    programmeId: (form.get("programmeId") as string) || undefined,
    courseId: (form.get("courseId") as string) || undefined,
    taskId: (form.get("taskId") as string) || undefined,
    note: (form.get("note") as string) || undefined,
  });

  // Phân quyền nộp:
  //  - Có quyền quản lý dữ liệu (tạo/sửa) hoặc nộp minh chứng → nộp được mọi tài liệu
  //    (qa_office, ban CN, khoa/trưởng khoa, giảng viên…).
  //  - Không có quyền nào nhưng là NGƯỜI ĐƯỢC GIAO công việc → nộp minh chứng cho ĐÚNG việc đó
  //    (hội đồng rà soát, lãnh đạo… do AI/Admin phân công đều nộp được).
  const canUpload =
    hasPermission(ctx, PERMISSIONS.DATA_CREATE) ||
    hasPermission(ctx, PERMISSIONS.DATA_UPDATE) ||
    hasPermission(ctx, PERMISSIONS.EVIDENCE_UPLOAD);
  if (!canUpload) {
    const task = meta.taskId ? await prisma.task.findFirst({ where: { id: meta.taskId }, select: { assigneeId: true } }) : null;
    if (!task || task.assigneeId !== ctx.actorId) {
      throw forbidden("Bạn chỉ được nộp minh chứng cho công việc được giao cho mình");
    }
  }

  const body = Buffer.from(await file.arrayBuffer());
  return created(await createDocument(meta, { fileName: file.name, body, contentType: file.type || undefined }));
});
