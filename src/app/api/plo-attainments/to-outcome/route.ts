import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { promoteAttainmentsToOutcomes } from "@/lib/obe/plo-attainment";

export const runtime = "nodejs";

// Tổng hợp mức đạt PLO → dữ liệu C8 (OutcomeMetric category=plo_attainment) — D7.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { programmeVersionId } = await parseBody(req, z.object({ programmeVersionId: z.string().min(1) }));
  return ok(await promoteAttainmentsToOutcomes(programmeVersionId));
});
