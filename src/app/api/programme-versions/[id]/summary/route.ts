import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { programmeExtractSummary } from "@/lib/ai/features";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Tổng quan dữ liệu đã trích xuất của CTĐT (PEO/PLO/PI/học phần/ma trận + tài liệu gốc).
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await programmeExtractSummary((await params).id));
});
