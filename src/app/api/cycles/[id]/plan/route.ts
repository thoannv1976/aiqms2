import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { applyCyclePlan, cyclePlanSchema } from "@/lib/cycle-plan/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Tạo hàng loạt công việc từ kế hoạch đã duyệt (AI).
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  return ok(await applyCyclePlan((await params).id, await parseBody(req, cyclePlanSchema)));
});
