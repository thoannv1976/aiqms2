import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { updateCriterionResponse, updateResponseSchema } from "@/lib/sar/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const PATCH = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.SAR_WRITE);
  const input = await parseBody(req, updateResponseSchema);
  return ok(await updateCriterionResponse((await params).id, input));
});
