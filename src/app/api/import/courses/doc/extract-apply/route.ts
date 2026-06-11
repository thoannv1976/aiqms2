import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { extractAndApplyStored } from "@/lib/import/syllabus";

export const runtime = "nodejs";

const schema = z.object({ documentId: z.string().min(1), programmeId: z.string().optional() });

// Trích xuất + ghi học phần từ một tài liệu đề cương đã lưu (cho chọn nhiều/hàng loạt).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { documentId, programmeId } = await parseBody(req, schema);
  return ok(await extractAndApplyStored(documentId, programmeId));
});
