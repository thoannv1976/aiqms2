import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { extractStoredSyllabus } from "@/lib/import/syllabus";

export const runtime = "nodejs";

const schema = z.object({ documentId: z.string().min(1) });

// Trích xuất đề cương từ một tài liệu đã upload trong kho (on-demand).
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { documentId } = await parseBody(req, schema);
  const { source, data, programmeId } = await extractStoredSyllabus(documentId);
  return ok({ source, extracted: data, documentId, programmeId });
});
