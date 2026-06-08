import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, noContent } from "@/lib/http/responses";
import { deletePlan, getPlan } from "@/lib/improvement/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getPlan((await params).id));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_DELETE);
  await deletePlan((await params).id);
  return noContent();
});
