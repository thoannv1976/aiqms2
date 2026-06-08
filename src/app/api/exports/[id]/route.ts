import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { getJob } from "@/lib/export/jobs";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Poll tiến độ job.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.REPORT_EXPORT);
  return ok(await getJob((await params).id));
});
