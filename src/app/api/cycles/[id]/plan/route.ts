import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { applyCyclePlan, cyclePlanSchema } from "@/lib/cycle-plan/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const schema = cyclePlanSchema.extend({ assignByRole: z.record(z.string(), z.string()).optional() });

// Tạo hàng loạt công việc từ kế hoạch đã duyệt (AI) + giao việc theo vai trò.
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { tasks, assignByRole } = await parseBody(req, schema);
  return ok(await applyCyclePlan((await params).id, { tasks }, assignByRole ?? {}));
});
