import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { extractSyllabusDoc } from "@/lib/import/syllabus";
import { createDocument } from "@/lib/documents/service";

export const runtime = "nodejs";

// Upload file đề cương học phần (.docx/.pdf) -> trích xuất XEM TRƯỚC (chưa ghi)
// + lưu file gốc vào kho Tài liệu (category 'syllabus'). Duyệt rồi gọi /apply.
export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Thiếu file (field 'file')");
  const kind = /\.docx$/i.test(file.name) ? "docx" : /\.pdf$/i.test(file.name) ? "pdf" : null;
  if (!kind) throw badRequest("Chỉ hỗ trợ file .docx hoặc .pdf");

  const buf = Buffer.from(await file.arrayBuffer());
  const { source, data } = await extractSyllabusDoc(buf, kind);

  const document = await createDocument(
    {
      title: data.code ? `Đề cương ${data.code} — ${data.name || file.name}` : file.name,
      category: "syllabus",
      note: "Nguồn import đề cương học phần",
    },
    { fileName: file.name, body: buf, contentType: file.type || undefined },
  );

  return ok({ source, extracted: data, documentId: document.id });
});
