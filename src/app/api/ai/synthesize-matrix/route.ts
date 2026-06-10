import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { synthesizeMatrixFromDocs } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI tổng hợp ma trận PLO-CLO từ đề án/CTĐT + đề cương đã upload (chỉ trả bản nháp).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok(await synthesizeMatrixFromDocs(versionId));
});
