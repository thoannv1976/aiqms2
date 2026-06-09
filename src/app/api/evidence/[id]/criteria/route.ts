import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { mapCriterion } from "@/lib/evidence/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Gắn minh chứng vào một tiêu chí (một minh chứng có thể liên kết nhiều tiêu chí).
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.EVIDENCE_UPLOAD);
  const { criterionId } = await parseBody(req, z.object({ criterionId: z.string().min(1) }));
  return created(await mapCriterion((await params).id, criterionId));
});
