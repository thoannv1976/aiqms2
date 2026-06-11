import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { generateCompliantSyllabus } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({ courseId: z.string().min(1) });

// AI tạo bản đề cương đạt chuẩn AUN-QA (viết lại toàn bộ) dựa trên nội dung hiện có.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.AI_USE);
  const { courseId } = await parseBody(req, schema);
  return ok({ fields: await generateCompliantSyllabus(courseId) });
});
