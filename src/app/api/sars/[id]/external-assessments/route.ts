import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { createExternalAssessment, createExternalSchema, listExternalAssessments } from "@/lib/sar/external-assessment";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Danh sách + tạo đợt đánh giá ngoài cho một SAR (D8).
export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await listExternalAssessments((await params).id));
});

export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const body = await parseBody(req, createExternalSchema.omit({ sarId: true }));
  return created(await createExternalAssessment({ ...body, sarId: (await params).id }));
});
