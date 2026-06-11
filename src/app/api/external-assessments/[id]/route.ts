import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, noContent } from "@/lib/http/responses";
import { deleteExternalAssessment, getExternalAssessment, updateExternalAssessment, updateExternalSchema } from "@/lib/sar/external-assessment";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getExternalAssessment((await params).id));
});

export const PATCH = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return ok(await updateExternalAssessment((await params).id, await parseBody(req, updateExternalSchema)));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  await deleteExternalAssessment((await params).id);
  return noContent();
});
