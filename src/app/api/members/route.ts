import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { listMembers } from "@/lib/users/service";

export const runtime = "nodejs";

// Danh sách thành viên rút gọn (id + tên) cho dropdown chọn người phụ trách.
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await listMembers());
});
