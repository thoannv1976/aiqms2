import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { evaluateMatrices } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI đánh giá hệ ma trận PLO của một phiên bản CTĐT.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok({ review: await evaluateMatrices(versionId) });
});
