import { authedRoute } from "@/lib/http/route";
import { requirePermission, hasPermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { parseBody } from "@/lib/http/validate";
import { ok, noContent, forbidden } from "@/lib/http/responses";
import { deleteCourse, getCourse, updateCourse, updateCourseSchema } from "@/lib/courses/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await getCourse((await params).id));
});

export const PATCH = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return ok(await updateCourse((await params).id, await parseBody(req, updateCourseSchema)));
});

export const DELETE = authedRoute(async (_req, _ctx, { params }: Params) => {
  // Quản lý chương trình (qa_office/ban CN có DATA_UPDATE) hoặc người xóa cứng (DATA_DELETE) đều xóa được.
  const ctx = requireTenantContext();
  if (!hasPermission(ctx, PERMISSIONS.DATA_DELETE) && !hasPermission(ctx, PERMISSIONS.DATA_UPDATE)) {
    throw forbidden("Cần quyền quản lý dữ liệu để xóa học phần");
  }
  await deleteCourse((await params).id);
  return noContent();
});
