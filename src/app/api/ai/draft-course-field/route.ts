import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { draftCourseField } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({
  courseId: z.string().min(1),
  field: z.enum(["description", "content", "teachingMethods", "assessmentMethods", "materials", "prerequisites"]),
  instruction: z.string().optional(),
});

// AI soạn/cải thiện một mục đề cương -> trả bản nháp (chưa lưu).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const { courseId, field, instruction } = await parseBody(req, schema);
  return ok({ text: await draftCourseField(courseId, field, instruction) });
});
