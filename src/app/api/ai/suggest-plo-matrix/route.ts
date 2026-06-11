import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { suggestPloMatrix } from "@/lib/ai/features";
import { PLO_DIMENSIONS, type PloDimension } from "@/lib/obe/plo-matrix";

export const runtime = "nodejs";

// AI nâng cấp/gợi ý ô cho một ma trận PLO (peo|teaching|assessment|measurement).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const url = new URL(req.url);
  const versionId = url.searchParams.get("versionId");
  const dimension = url.searchParams.get("dimension") as PloDimension | null;
  if (!versionId) throw badRequest("Thiếu versionId");
  if (!dimension || !PLO_DIMENSIONS.includes(dimension)) throw badRequest("dimension không hợp lệ");
  return ok(await suggestPloMatrix(versionId, dimension));
});
