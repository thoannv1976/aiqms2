import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { tenantDashboard } from "@/lib/dashboard/service";

export const runtime = "nodejs";

export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await tenantDashboard());
});
