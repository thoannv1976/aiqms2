import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { importMatrix, matrixTemplate } from "@/lib/import/excel";

export const runtime = "nodejs";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Tải file Excel mẫu (ma trận PLO–học phần & CLO–PLO).
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const buf = await matrixTemplate();
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": XLSX, "Content-Disposition": 'attachment; filename="mau_import_ma_tran.xlsx"' },
  });
});

// Nạp ma trận PLO–học phần (I/R/M) & CLO–PLO từ Excel.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Thiếu file Excel (field 'file')");
  const buf = Buffer.from(await file.arrayBuffer());
  return ok(await importMatrix(buf));
});
