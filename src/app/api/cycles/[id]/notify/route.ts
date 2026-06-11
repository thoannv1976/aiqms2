import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { notifyCycleMembers } from "@/lib/cycle-plan/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const schema = z.object({ message: z.string().optional() });

// Gửi thông báo tới các thành viên được phân công trong đợt.
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const { message } = await parseBody(req, schema);
  return ok(await notifyCycleMembers((await params).id, message));
});
