import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { cloPloSchema, mapCloPlo } from "@/lib/obe/matrix";

export const runtime = "nodejs";

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return created(await mapCloPlo(await parseBody(req, cloPloSchema)));
});
