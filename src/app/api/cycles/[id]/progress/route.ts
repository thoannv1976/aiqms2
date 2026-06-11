import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { cycleProgress } from "@/lib/cycle-progress/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Bảng theo dõi tiến độ đợt (D4): % theo tiêu chí, MC đã thu, ai trễ hạn.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await cycleProgress((await params).id));
});
