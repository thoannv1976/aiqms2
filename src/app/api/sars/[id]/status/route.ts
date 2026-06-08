import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { changeSarStatus } from "@/lib/sar/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.SAR_WRITE);
  const { to } = await parseBody(req, z.object({ to: z.string().min(1) }));
  return ok(await changeSarStatus((await params).id, to));
});
