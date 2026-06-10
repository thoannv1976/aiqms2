import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { draftFullSyllabus } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({
  courseId: z.string().min(1),
  onlyEmpty: z.boolean().optional().default(true),
});

// AI điền nhanh toàn bộ đề cương (các mục còn trống) trong một lần gọi -> bản nháp.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const { courseId, onlyEmpty } = await parseBody(req, schema);
  return ok({ fields: await draftFullSyllabus(courseId, onlyEmpty) });
});
