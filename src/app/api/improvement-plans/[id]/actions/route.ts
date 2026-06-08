import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { actionSchema, addAction } from "@/lib/improvement/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return created(await addAction((await params).id, await parseBody(req, actionSchema)));
});
