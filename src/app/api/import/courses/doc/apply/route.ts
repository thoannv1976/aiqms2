import { z } from "zod";
import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { applyExtractedSyllabus, extractedSyllabusSchema } from "@/lib/import/syllabus";
import { linkDocument } from "@/lib/documents/service";

export const runtime = "nodejs";

const schema = extractedSyllabusSchema.extend({
  documentId: z.string().optional(), // file gốc đã lưu ở bước xem trước -> gắn vào học phần
  programmeId: z.string().optional(), // gắn đề cương với CTĐT đang kiểm định
});

// Ghi đề cương đã DUYỆT vào CSDL + gắn file gốc với học phần/CTĐT.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const { documentId, programmeId, ...data } = await parseBody(req, schema);
  const result = await applyExtractedSyllabus(data, programmeId);
  if (documentId) {
    await linkDocument(documentId, { courseId: result.courseId, programmeId });
  }
  return ok(result);
});
