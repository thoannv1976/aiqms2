import { authedRoute } from "@/lib/http/route";
import { requirePermission, hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { ok, noContent, forbidden } from "@/lib/http/responses";
import { deleteDocument, getDocument } from "@/lib/documents/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getDocument((await params).id));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  const ctx = requireTenantContext();
  const id = (await params).id;
  // Quản lý nội dung (qa_office/ban CN có DATA_UPDATE) hoặc người xóa cứng (DATA_DELETE) đều xóa được
  // tài liệu trong kho; người chỉ có quyền nộp minh chứng được xóa file DO CHÍNH MÌNH nộp.
  if (!hasPermission(ctx, PERMISSIONS.DATA_DELETE) && !hasPermission(ctx, PERMISSIONS.DATA_UPDATE)) {
    const doc = await getDocument(id);
    if (!(hasPermission(ctx, PERMISSIONS.EVIDENCE_UPLOAD) && doc.createdBy === ctx.actorId)) {
      throw forbidden("Cần quyền quản lý dữ liệu, hoặc chỉ được xóa minh chứng do chính bạn nộp");
    }
  }
  await deleteDocument(id);
  return noContent();
});

