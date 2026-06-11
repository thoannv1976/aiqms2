import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { criterionWorkspace } from "@/lib/sar/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; criterionId: string }> };

// Workspace theo tiêu chí: yêu cầu con + minh chứng đã gắn + gợi ý minh chứng.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const { id, criterionId } = await params;
  return ok(await criterionWorkspace(id, criterionId));
});
