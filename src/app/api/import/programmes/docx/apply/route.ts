import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { applyExtractedProgramme, extractedProgrammeSchema } from "@/lib/import/docx";

export const runtime = "nodejs";

// Ghi dữ liệu CTĐT đã DUYỆT (sau khi xem trước) vào CSDL.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const data = await parseBody(req, extractedProgrammeSchema);
  return ok(await applyExtractedProgramme(data));
});
