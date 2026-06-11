import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { listMyNotifications, markAllRead, markNotificationRead } from "@/lib/notifications/service";

export const runtime = "nodejs";

// Thông báo của tôi (mọi vai trò đã đăng nhập đều xem được của chính mình).
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";
  return ok(await listMyNotifications(unreadOnly));
});

const schema = z.object({ id: z.string().optional(), all: z.boolean().optional() });

// Đánh dấu đã đọc (một thông báo hoặc tất cả).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const { id, all } = await parseBody(req, schema);
  if (all) return ok(await markAllRead());
  if (id) return ok(await markNotificationRead(id));
  return ok({ ok: true });
});
