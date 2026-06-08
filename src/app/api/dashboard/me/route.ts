import { authedRoute } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { personalDashboard } from "@/lib/dashboard/service";

export const runtime = "nodejs";

export const GET = authedRoute(async (_req, ctx) => {
  return ok(await personalDashboard(ctx.userId));
});
