import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { suggestImprovementActions } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI gợi ý hành động cải tiến (PDCA) + KPI cho một kế hoạch — chỉ trả gợi ý, không tự lưu.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const planId = new URL(req.url).searchParams.get("planId");
  if (!planId) throw badRequest("Thiếu planId");
  return ok(await suggestImprovementActions(planId));
});
