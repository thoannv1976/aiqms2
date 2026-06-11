import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { created } from "@/lib/http/responses";
import { promoteSurveyToOutcome } from "@/lib/surveys/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Đưa kết quả khảo sát vào dữ liệu C8 (OutcomeMetric) — C4.
export const POST = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  return created(await promoteSurveyToOutcome((await params).id));
});
