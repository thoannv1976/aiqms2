import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, noContent } from "@/lib/http/responses";
import {
  deleteUser,
  getUser,
  updateUser,
  updateUserSchema,
} from "@/lib/users/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  const { id } = await params;
  return ok(await getUser(id));
});

export const PATCH = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  const { id } = await params;
  const input = await parseBody(req, updateUserSchema);
  return ok(await updateUser(id, input));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  const { id } = await params;
  await deleteUser(id);
  return noContent();
});
