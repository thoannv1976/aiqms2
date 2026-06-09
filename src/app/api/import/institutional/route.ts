import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { importInstitutional, institutionalTemplate } from "@/lib/import/excel";

export const runtime = "nodejs";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Tải file Excel mẫu (dữ liệu C5–C8).
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const buf = await institutionalTemplate();
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": XLSX, "Content-Disposition": 'attachment; filename="mau_import_C5_C8.xlsx"' },
  });
});

// Nạp dữ liệu C5–C8 (đội ngũ GV / người học / CSVC / kết quả đầu ra) từ Excel.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Thiếu file Excel (field 'file')");
  const buf = Buffer.from(await file.arrayBuffer());
  return ok(await importInstitutional(buf));
});
