import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { downloadJob } from "@/lib/export/jobs";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Tải file kết quả.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.REPORT_EXPORT);
  const { body, fileName, contentType } = await downloadJob((await params).id);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
