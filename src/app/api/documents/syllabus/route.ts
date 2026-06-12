import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { listSyllabusRepo } from "@/lib/documents/service";

export const runtime = "nodejs";

// Kho đề cương giàu thông tin (lọc theo CTĐT) — trích xuất chưa, dung lượng, ngày, nơi lưu.
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const programmeId = new URL(req.url).searchParams.get("programmeId") || undefined;
  return ok(await listSyllabusRepo(programmeId));
});
