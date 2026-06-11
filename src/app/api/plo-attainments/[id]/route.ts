import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { noContent } from "@/lib/http/responses";
import { deleteAttainment } from "@/lib/obe/plo-attainment";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  await deleteAttainment((await params).id);
  return noContent();
});
