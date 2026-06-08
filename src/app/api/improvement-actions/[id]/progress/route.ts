import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { logProgress } from "@/lib/improvement/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const schema = z.object({ note: z.string().min(1), percent: z.number().int().min(0).max(100).optional() });

export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const { note, percent } = await parseBody(req, schema);
  return created(await logProgress((await params).id, note, percent));
});
