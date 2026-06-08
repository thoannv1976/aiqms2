import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, created, badRequest } from "@/lib/http/responses";
import { addPlo, listPlos, outcomeSchema } from "@/lib/programmes/service";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok(await listPlos(versionId));
});

const bodySchema = outcomeSchema.extend({ programmeVersionId: z.string().min(1) });

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { programmeVersionId, ...rest } = await parseBody(req, bodySchema);
  return created(await addPlo(programmeVersionId, rest));
});
