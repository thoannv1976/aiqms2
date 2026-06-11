import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { externalScoreSchema, setExternalScore } from "@/lib/sar/external-assessment";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Chấm điểm tiêu chí của đoàn đánh giá ngoài (D8).
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return ok(await setExternalScore((await params).id, await parseBody(req, externalScoreSchema)));
});
