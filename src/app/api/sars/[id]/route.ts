import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, noContent } from "@/lib/http/responses";
import { deleteSar, getSar } from "@/lib/sar/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getSar((await params).id));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_DELETE);
  await deleteSar((await params).id);
  return noContent();
});
