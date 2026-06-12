import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { evaluateProgramme } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI đánh giá CTĐT theo AUN-QA (C1/C2) — trả nhận xét.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const versionId = new URL(req.url).searchParams.get("versionId");
  if (!versionId) throw badRequest("Thiếu versionId");
  return ok({ review: await evaluateProgramme(versionId) });
});
