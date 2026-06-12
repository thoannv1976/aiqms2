import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { parseBody } from "@/lib/http/validate";
import { ok, forbidden } from "@/lib/http/responses";
import { applyProgrammeEvalToSar } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({
  draftId: z.string().min(1),
  sarId: z.string().min(1),
  criterionCode: z.string().min(1),
  field: z.enum(["analysis", "strengths", "weaknesses"]).default("analysis"),
});

// Duyệt bản nháp đánh giá CTĐT → ghi vào tiêu chí SAR (C1/C2). Cần quyền viết/duyệt SAR.
export const POST = authedRoute(async (req) => {
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.SAR_WRITE) && !hasPermission(ctx, PERMISSIONS.SAR_REVIEW) && !hasPermission(ctx, PERMISSIONS.CONTENT_APPROVE)) {
    throw forbidden("Cần quyền viết/rà soát/duyệt SAR");
  }
  const { draftId, sarId, criterionCode, field } = await parseBody(req, schema);
  return ok(await applyProgrammeEvalToSar(draftId, sarId, criterionCode, field));
});
