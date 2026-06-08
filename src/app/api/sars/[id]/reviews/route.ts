import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, created } from "@/lib/http/responses";
import { openReview, aggregateScores } from "@/lib/sar/internal-review";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Mở phiên rà soát nội bộ của reviewer hiện tại.
export const POST = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.SAR_REVIEW);
  return created(await openReview((await params).id));
});

// Tổng hợp/so sánh điểm rà soát nội bộ theo tiêu chí.
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.SAR_REVIEW);
  return ok(await aggregateScores((await params).id));
});
