import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { createVersion, createVersionSchema } from "@/lib/programmes/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const input = await parseBody(req, createVersionSchema);
  return created(await createVersion((await params).id, input));
});
