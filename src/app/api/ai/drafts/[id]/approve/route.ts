import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { approveDraft } from "@/lib/ai/features";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Duyệt bản nháp AI -> ghi vào hồ sơ chính (human-in-the-loop).
export const POST = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.CONTENT_APPROVE);
  return ok(await approveDraft((await params).id));
});
