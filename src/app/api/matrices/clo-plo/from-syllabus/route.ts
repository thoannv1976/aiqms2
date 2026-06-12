import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { generateCloPloForCourse } from "@/lib/import/syllabus";

export const runtime = "nodejs";

// AI đọc đề cương của học phần → tạo CLO + ma trận CLO–PLO cho học phần đó.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId) throw badRequest("Thiếu courseId");
  return ok(await generateCloPloForCourse(courseId));
});
