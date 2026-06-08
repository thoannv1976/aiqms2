import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, noContent } from "@/lib/http/responses";
import { deleteEvidence, getEvidence } from "@/lib/evidence/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getEvidence((await params).id));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_DELETE);
  await deleteEvidence((await params).id);
  return noContent();
});
