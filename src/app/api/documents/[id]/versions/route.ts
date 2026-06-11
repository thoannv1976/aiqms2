import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, created, badRequest } from "@/lib/http/responses";
import { listDocumentVersions, uploadNewVersion } from "@/lib/documents/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Lịch sử phiên bản của tài liệu (D10).
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await listDocumentVersions((await params).id));
});

// Tải lên phiên bản mới (multipart/form-data: field "file" + title/note tùy chọn).
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Cần multipart/form-data");
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Thiếu file (field 'file')");
  const body = Buffer.from(await file.arrayBuffer());
  return created(
    await uploadNewVersion(
      (await params).id,
      { fileName: file.name, body, contentType: file.type || undefined },
      { title: (form.get("title") as string) || undefined, note: (form.get("note") as string) || undefined },
    ),
  );
});
