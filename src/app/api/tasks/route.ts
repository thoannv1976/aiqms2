import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parsePagination } from "@/lib/http/pagination";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { boardView, createTask, createTaskSchema, listTasks } from "@/lib/tasks/service";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const url = new URL(req.url);
  if (url.searchParams.get("view") === "board") return ok(await boardView());
  return ok(
    await listTasks(parsePagination(req), {
      status: url.searchParams.get("status") ?? undefined,
      assigneeId: url.searchParams.get("assigneeId") ?? undefined,
    }),
  );
});

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  return created(await createTask(await parseBody(req, createTaskSchema)));
});
