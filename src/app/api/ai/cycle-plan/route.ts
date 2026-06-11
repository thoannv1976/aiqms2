import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { generateCyclePlan } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI lập kế hoạch công việc cho đợt tự đánh giá (trả bản nháp).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const cycleId = new URL(req.url).searchParams.get("cycleId");
  if (!cycleId) throw badRequest("Thiếu cycleId");
  return ok(await generateCyclePlan(cycleId));
});
