import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { createExportJob, createExportSchema } from "@/lib/export/jobs";

export const runtime = "nodejs";

// Tạo job xuất báo cáo (SAR Word/PDF, minh chứng Excel/zip).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.REPORT_EXPORT);
  return created(await createExportJob(await parseBody(req, createExportSchema)));
});
