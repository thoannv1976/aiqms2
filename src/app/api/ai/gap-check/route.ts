import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { gapCheck } from "@/lib/ai/features";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const sarId = new URL(req.url).searchParams.get("sarId");
  if (!sarId) throw badRequest("Thiếu sarId");
  return ok(await gapCheck(sarId));
});
