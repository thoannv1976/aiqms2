import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, created, badRequest } from "@/lib/http/responses";
import { attainmentSchema, createAttainment, listAttainments } from "@/lib/obe/plo-attainment";

export const runtime = "nodejs";

// Danh sách mức đạt PLO của một phiên bản CTĐT (D7).
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok(await listAttainments(versionId));
});

const bodySchema = attainmentSchema.extend({ programmeVersionId: z.string().min(1) });

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { programmeVersionId, ...rest } = await parseBody(req, bodySchema);
  return created(await createAttainment(programmeVersionId, rest));
});
