import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { suggestProgrammeUpgrade } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI đề xuất bộ PEO/PLO nâng cấp (bản nháp) cho một phiên bản CTĐT.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok(await suggestProgrammeUpgrade(versionId));
});
