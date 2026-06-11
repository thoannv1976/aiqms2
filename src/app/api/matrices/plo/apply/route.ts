import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { applyPloMatrixCells, matrixCellsDraftSchema, PLO_DIMENSIONS } from "@/lib/obe/plo-matrix";

export const runtime = "nodejs";

const schema = matrixCellsDraftSchema.extend({
  versionId: z.string().min(1),
  dimension: z.enum(PLO_DIMENSIONS),
});

// Ghi hàng loạt ô ma trận đã duyệt (từ AI) cho một chiều.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const { versionId, dimension, cells } = await parseBody(req, schema);
  return ok(await applyPloMatrixCells(versionId, dimension, { cells }));
});
