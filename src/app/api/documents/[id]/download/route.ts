import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { downloadDocument } from "@/lib/documents/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Tải file tài liệu.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const { body, fileName, contentType } = await downloadDocument((await params).id);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
});
