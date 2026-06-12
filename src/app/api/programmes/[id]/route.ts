import { authedRoute } from "@/lib/http/route";
import { requirePermission, hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { ok, noContent, forbidden } from "@/lib/http/responses";
import { deleteProgramme, getProgramme } from "@/lib/programmes/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getProgramme((await params).id));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.DATA_DELETE) && !hasPermission(ctx, PERMISSIONS.DATA_UPDATE)) {
    throw forbidden("Cần quyền quản lý dữ liệu để xóa CTĐT");
  }
  await deleteProgramme((await params).id);
  return noContent();
});
