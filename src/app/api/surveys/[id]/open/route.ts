import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { openSurvey } from "@/lib/surveys/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const POST = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return ok(await openSurvey((await params).id));
});
