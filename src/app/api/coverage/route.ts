import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { coverageWarnings } from "@/lib/obe/coverage";

export const runtime = "nodejs";

/** Cảnh báo độ phủ OBE cho một phiên bản CTĐT. */
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok(await coverageWarnings(versionId));
});
