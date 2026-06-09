import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { addPeo, outcomeSchema } from "@/lib/programmes/service";

export const runtime = "nodejs";

const bodySchema = outcomeSchema.extend({ programmeVersionId: z.string().min(1) });

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { programmeVersionId, ...rest } = await parseBody(req, bodySchema);
  return created(await addPeo(programmeVersionId, rest));
});
