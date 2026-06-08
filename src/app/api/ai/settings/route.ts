import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { getSettings, updateSettings, updateSettingsSchema } from "@/lib/ai/settings";

export const runtime = "nodejs";

export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  return ok(await getSettings());
});

export const PUT = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.USER_MANAGE);
  return ok(await updateSettings(await parseBody(req, updateSettingsSchema)));
});
