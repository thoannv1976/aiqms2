import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { usageStats } from "@/lib/ai/settings";

export const runtime = "nodejs";

// Trang xem chi phí/token AI cho admin.
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  return ok(await usageStats());
});
