import { authedRoute } from "@/lib/http/route";
import { hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { parseBody } from "@/lib/http/validate";
import { ok, forbidden } from "@/lib/http/responses";
import { requirementResponseSchema, setRequirementResponse } from "@/lib/sar/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Đặt mức đáp ứng cho một yêu cầu con (sub-criterion) trong SAR.
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.SAR_WRITE) && !hasPermission(ctx, PERMISSIONS.SAR_REVIEW) && !hasPermission(ctx, PERMISSIONS.CONTENT_APPROVE)) {
    throw forbidden("Cần quyền viết/rà soát/duyệt SAR");
  }
  return ok(await setRequirementResponse((await params).id, await parseBody(req, requirementResponseSchema)));
});
