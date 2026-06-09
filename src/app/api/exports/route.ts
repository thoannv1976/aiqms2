import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parsePagination } from "@/lib/http/pagination";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { createExportJob, createExportSchema, listExports } from "@/lib/export/jobs";

export const runtime = "nodejs";

// Lịch sử job xuất báo cáo.
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.REPORT_EXPORT);
  return ok(await listExports(parsePagination(req)));
});

// Tạo job xuất báo cáo (SAR Word/PDF, minh chứng Excel/zip).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.REPORT_EXPORT);
  return created(await createExportJob(await parseBody(req, createExportSchema)));
});
