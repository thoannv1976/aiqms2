import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { listMyTasks } from "@/lib/tasks/service";

export const runtime = "nodejs";

// Công việc được giao cho người dùng hiện tại.
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await listMyTasks());
});
