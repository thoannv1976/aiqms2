import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, created, badRequest } from "@/lib/http/responses";
import { mapPloCourse, ploCourseMatrix, ploCourseSchema } from "@/lib/obe/matrix";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok(await ploCourseMatrix(versionId));
});

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return created(await mapPloCourse(await parseBody(req, ploCourseSchema)));
});
