import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { autoAssignCycleTasks } from "@/lib/cycle-plan/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Tự động phân công công việc trong đợt theo vai trò (round-robin).
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const onlyUnassigned = new URL(req.url).searchParams.get("all") !== "1";
  return ok(await autoAssignCycleTasks((await params).id, { onlyUnassigned }));
});
