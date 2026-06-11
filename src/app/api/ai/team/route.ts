import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { suggestAccreditationTeam } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI đề xuất nhóm kiểm định (bản nháp tài khoản cần tạo) cho một đợt.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const cycleId = new URL(req.url).searchParams.get("cycleId");
  if (!cycleId) throw badRequest("Thiếu cycleId");
  return ok(await suggestAccreditationTeam(cycleId));
});
