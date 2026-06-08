import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { draftSarCriterion } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({
  sarResponseId: z.string().min(1),
  field: z.enum(["analysis", "strengths", "weaknesses"]).default("analysis"),
});

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const { sarResponseId, field } = await parseBody(req, schema);
  return created(await draftSarCriterion(sarResponseId, field));
});
