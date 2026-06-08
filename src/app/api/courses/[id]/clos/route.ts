import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { addClo, cloSchema } from "@/lib/courses/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  return created(await addClo((await params).id, await parseBody(req, cloSchema)));
});
