import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { assistantAnswer } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({
  screen: z.string().min(1),
  question: z.string().min(1),
});

// Trợ lý AI hướng dẫn theo màn hình.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const { screen, question } = await parseBody(req, schema);
  return ok({ answer: await assistantAnswer(screen, question) });
});
