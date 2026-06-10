import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { extractProgrammeDoc } from "@/lib/import/docx";
import { createDocument } from "@/lib/documents/service";

export const runtime = "nodejs";

// Tải lên file CTĐT (.docx) -> trích xuất dữ liệu (XEM TRƯỚC, chưa ghi) +
// lưu file gốc vào kho tài liệu để đối chiếu. Người dùng duyệt rồi gọi /apply.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Thiếu file Word (field 'file')");
  if (!/\.docx$/i.test(file.name)) throw badRequest("Chỉ hỗ trợ file .docx (Word)");

  const buf = Buffer.from(await file.arrayBuffer());
  const { source, data } = await extractProgrammeDoc(buf);

  // Lưu file gốc vào kho tài liệu (category CTĐT gốc) — không mất dù chưa apply.
  const document = await createDocument(
    { title: data.name || file.name, category: "ctdt_source", note: "Nguồn import CTĐT" },
    { fileName: file.name, body: buf, contentType: file.type || undefined },
  );

  return ok({ source, extracted: data, documentId: document.id });
});
