import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { summarizeEvidence } from "@/lib/ai/features";

export const runtime = "nodejs";

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const { evidenceId } = await parseBody(req, z.object({ evidenceId: z.string().min(1) }));
  return created(await summarizeEvidence(evidenceId));
});
