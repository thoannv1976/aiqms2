import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, noContent } from "@/lib/http/responses";
import { deleteTask, updateTask, updateTaskSchema } from "@/lib/tasks/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const PATCH = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return ok(await updateTask((await params).id, await parseBody(req, updateTaskSchema)));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_DELETE);
  await deleteTask((await params).id);
  return noContent();
});
