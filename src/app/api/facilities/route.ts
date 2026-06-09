import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parsePagination } from "@/lib/http/pagination";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { createFacility, facilitySchema, listFacilities } from "@/lib/institutional/service";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await listFacilities(parsePagination(req)));
});
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  return created(await createFacility(await parseBody(req, facilitySchema)));
});
