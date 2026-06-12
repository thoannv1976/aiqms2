import { authedRoute } from "@/lib/http/route";
import { hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { ok, forbidden } from "@/lib/http/responses";
import { cleanupMissingSyllabi } from "@/lib/documents/service";

export const runtime = "nodejs";

// Dọn đề cương đã mất file khỏi kho (bản ghi mồ côi). Cần quyền quản lý dữ liệu.
export const POST = authedRoute(async (req) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.DATA_DELETE) && !hasPermission(ctx, PERMISSIONS.DATA_UPDATE)) {
    throw forbidden("Cần quyền quản lý dữ liệu để dọn kho");
  }
  const programmeId = new URL(req.url).searchParams.get("programmeId") || undefined;
  return ok(await cleanupMissingSyllabi(programmeId));
});
