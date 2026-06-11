import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { suggestScreenActions } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI gợi ý hành động tiếp theo cho màn hình hiện tại.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const screen = new URL(req.url).searchParams.get("screen");
  if (!screen) throw badRequest("Thiếu screen");
  return ok({ actions: await suggestScreenActions(screen) });
});
