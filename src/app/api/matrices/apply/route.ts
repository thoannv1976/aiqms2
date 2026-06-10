import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { applyMatrixMappings, matrixDraftSchema } from "@/lib/obe/matrix";

export const runtime = "nodejs";

const schema = matrixDraftSchema.extend({ versionId: z.string().min(1) });

// Áp dụng ma trận (PLO×học phần I/R/M + CLO–PLO) đã duyệt vào phiên bản CTĐT.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const { versionId, ploCourse, cloPlo } = await parseBody(req, schema);
  return ok(await applyMatrixMappings(versionId, { ploCourse, cloPlo }));
});
