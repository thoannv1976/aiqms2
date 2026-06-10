import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { reviewCourseSyllabus } from "@/lib/ai/features";

export const runtime = "nodejs";

// AI rà soát đề cương theo Mẫu 5A/5B + AUN-QA.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId) throw badRequest("Thiếu courseId");
  return ok({ review: await reviewCourseSyllabus(courseId) });
});
