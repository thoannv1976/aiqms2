import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { dueReminders } from "@/lib/reminders/service";

export const runtime = "nodejs";

// Chạy nhắc hạn nhiệm vụ thủ công (D5). Có thể gọi định kỳ qua cron ngoài.
export const POST = authedRoute(async () => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  return ok(await dueReminders());
});
