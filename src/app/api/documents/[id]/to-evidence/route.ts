import { authedRoute } from "@/lib/http/route";
import { hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { ok, forbidden } from "@/lib/http/responses";
import { promoteDocumentToEvidence } from "@/lib/documents/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Đưa file (vd minh chứng nộp ở task) vào hồ sơ minh chứng chính thức (MC-XXXX).
export const POST = authedRoute(async (_req, _ctx, { params }: Params) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.EVIDENCE_UPLOAD) && !hasPermission(ctx, PERMISSIONS.DATA_CREATE)) {
    throw forbidden("Cần quyền upload minh chứng hoặc tạo dữ liệu");
  }
  return ok(await promoteDocumentToEvidence((await params).id));
});
