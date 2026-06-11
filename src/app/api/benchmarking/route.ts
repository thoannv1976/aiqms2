import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { benchmarkReport } from "@/lib/institutional/benchmark";

export const runtime = "nodejs";

// Báo cáo đối sánh chỉ số C8 với mốc tham chiếu + chỉ tiêu (D9).
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await benchmarkReport());
});
