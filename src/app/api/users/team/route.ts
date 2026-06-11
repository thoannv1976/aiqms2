import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { createAccreditationTeam, createTeamSchema } from "@/lib/users/service";

export const runtime = "nodejs";

// Tạo hàng loạt tài khoản nhóm kiểm định (từ đề xuất AI), idempotent theo email.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  return created(await createAccreditationTeam(await parseBody(req, createTeamSchema)));
});
