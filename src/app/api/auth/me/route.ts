import { authedRoute } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { getUser } from "@/lib/users/service";

export const runtime = "nodejs";

/** Thông tin user hiện tại + quyền hiệu dụng. */
export const GET = authedRoute(async (_req, ctx) => {
  const user = await getUser(ctx.userId);
  return ok({
    user,
    tenant: ctx.tenant,
    roles: ctx.roles,
    isSuperAdmin: ctx.isSuperAdmin,
  });
});
