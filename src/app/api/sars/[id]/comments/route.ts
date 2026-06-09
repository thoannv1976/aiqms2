import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { parseBody } from "@/lib/http/validate";
import { ok, created, forbidden } from "@/lib/http/responses";
import { addSarComment, listSarComments } from "@/lib/sar/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Xem góp ý/nhận xét của SAR.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.DATA_VIEW)) throw forbidden();
  return ok(await listSarComments((await params).id));
});

const schema = z.object({ body: z.string().min(1), criterionId: z.string().optional() });

// Thêm góp ý (rà soát cấp khoa/trường, viết SAR hoặc duyệt nội dung).
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  const ctx = requireTenantContext();
  const can =
    hasPermission(ctx, PERMISSIONS.SAR_REVIEW) ||
    hasPermission(ctx, PERMISSIONS.CONTENT_APPROVE) ||
    hasPermission(ctx, PERMISSIONS.SAR_WRITE);
  if (!can) throw forbidden("Cần quyền rà soát/duyệt/viết SAR để góp ý");
  const { body, criterionId } = await parseBody(req, schema);
  return created(await addSarComment((await params).id, body, criterionId));
});
