import { authedRoute } from "@/lib/http/route";
import { requirePermission, hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
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

// Upload tài liệu (multipart/form-data: field "file" + meta title/category/note/programmeId).
export const POST = authedRoute(async (req) => {
  // Nộp minh chứng/tải tài liệu: chấp nhận quyền tạo dữ liệu HOẶC quyền nộp minh chứng
  // (giảng viên chỉ có EVIDENCE_UPLOAD vẫn nộp được file cho công việc được giao).
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.DATA_CREATE) && !hasPermission(ctx, PERMISSIONS.EVIDENCE_UPLOAD)) {
    throw forbidden("Cần quyền tạo dữ liệu hoặc nộp minh chứng");
  }
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
  const body = Buffer.from(await file.arrayBuffer());
  return created(await createDocument(meta, { fileName: file.name, body, contentType: file.type || undefined }));
});
