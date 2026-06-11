import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { aiStatus } from "@/lib/ai/service";

export const runtime = "nodejs";

// Trạng thái cấu hình AI của trường (đã bật? có key? dùng mock? model/provider gì) — KHÔNG trả key.
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.AI_USE);
  return ok(await aiStatus());
});
