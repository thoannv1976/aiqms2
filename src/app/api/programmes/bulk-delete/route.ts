import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { parseBody } from "@/lib/http/validate";
import { ok, forbidden } from "@/lib/http/responses";
import { deleteProgrammesBulk } from "@/lib/programmes/service";

export const runtime = "nodejs";

// Xóa nhiều CTĐT cùng lúc. Cần quyền quản lý dữ liệu.
export const POST = authedRoute(async (req) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.DATA_DELETE) && !hasPermission(ctx, PERMISSIONS.DATA_UPDATE)) {
    throw forbidden("Cần quyền quản lý dữ liệu để xóa CTĐT");
  }
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string()).min(1) }));
  return ok(await deleteProgrammesBulk(ids));
});
