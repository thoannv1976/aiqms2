import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parsePagination } from "@/lib/http/pagination";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { createUser, createUserSchema, listUsers } from "@/lib/users/service";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  return ok(await listUsers(parsePagination(req)));
});

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  const input = await parseBody(req, createUserSchema);
  return created(await createUser(input));
});
