import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, created, badRequest } from "@/lib/http/responses";
import { PLO_DIMENSIONS, ploMatrix, setCellSchema, setPloMatrixCell, type PloDimension } from "@/lib/obe/plo-matrix";

export const runtime = "nodejs";

// Lấy ma trận PLO × <chiều> (peo | teaching | assessment | measurement).
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const url = new URL(req.url);
  const versionId = url.searchParams.get("versionId");
  const dimension = url.searchParams.get("dimension") as PloDimension | null;
  if (!versionId) throw badRequest("Thiếu versionId");
  if (!dimension || !PLO_DIMENSIONS.includes(dimension)) throw badRequest("dimension không hợp lệ");
  return ok(await ploMatrix(versionId, dimension));
});

// Đặt/xóa một ô ma trận.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  return created(await setPloMatrixCell(await parseBody(req, setCellSchema)));
});
