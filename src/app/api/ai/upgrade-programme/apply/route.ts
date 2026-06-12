import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, badRequest } from "@/lib/http/responses";
import { applyProgrammeUpgrade } from "@/lib/ai/features";

export const runtime = "nodejs";

const schema = z.object({
  versionId: z.string().min(1),
  peos: z.array(z.object({ code: z.string(), description: z.string() })).default([]),
  plos: z.array(z.object({ code: z.string(), description: z.string() })).default([]),
});

// Áp dụng bản nâng cấp PEO/PLO đã duyệt vào CTĐT. Cần quyền cập nhật dữ liệu.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_UPDATE);
  const { versionId, peos, plos } = await parseBody(req, schema);
  if (peos.length === 0 && plos.length === 0) throw badRequest("Không có PEO/PLO để áp dụng");
  return ok(await applyProgrammeUpgrade(versionId, { peos, plos }));
});
