import JSZip from "jszip";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { docxToText } from "@/lib/import/docx";
import { applyExtractedSyllabus, extractSyllabusByRules, extractStoredSyllabus, pdfToText } from "@/lib/import/syllabus";
import { createDocument } from "@/lib/documents/service";
import { createProgramme } from "@/lib/programmes/service";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

function p(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}
function row(...cells: string[]): string {
  return `<w:tr>${cells.map((t) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`;
}
async function buildSyllabusDocx(): Promise<Buffer> {
  const body = [
    p("ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN (MẪU 5A)"),
    p("Tên học phần: Thương mại điện tử (E-commerce)"),
    p("Mã học phần: TMAE306"),
    p("Số tín chỉ: 3 tín chỉ"),
    p("Điều kiện tiên quyết: Kinh tế vi mô (KTEE201)"),
    p("2. MÔ TẢ HỌC PHẦN"),
    p("Học phần trang bị khung lý thuyết và quy trình triển khai thương mại điện tử."),
    p("3. CHUẨN ĐẦU RA VÀ ĐÓNG GÓP CỦA HỌC PHẦN"),
    `<w:tbl>${row("CLO1", "Phân tích được các mô hình kinh doanh thương mại điện tử hiện đại.")}${row("CLO2", "Vận dụng marketing số và AI để xây dựng chiến lược tiếp thị.")}</w:tbl>`,
    `<w:tbl>${row("CLO\\PLO", "PLO1", "PLO2")}${row("CLO1", "2", "—")}${row("CLO2", "—", "3")}</w:tbl>`,
    p("4. HỌC LIỆU"),
    p("[TL1] Laudon & Traver (2024), E-commerce 2024–2025, Pearson."),
    p("5. NỘI DUNG, PHƯƠNG PHÁP VÀ KẾ HOẠCH GIẢNG DẠY"),
    p("Chương 1. Tổng quan TMĐT trong nền kinh tế số"),
    p("Chương 2. Mô hình kinh doanh và chiến lược TMĐT"),
    p("5.2. PHƯƠNG PHÁP GIẢNG DẠY"),
    p("Lecture – Case study – Project-based – Lab Shopify."),
    p("7. PHƯƠNG PHÁP, HÌNH THỨC KIỂM TRA, ĐÁNH GIÁ"),
    p("Chuyên cần 10% – Giữa kỳ 20% – Dự án 20% – Cuối kỳ 50%."),
  ].join("");
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  const zip = new JSZip();
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("Import đề cương học phần từ Word/PDF", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("extractSyllabusByRules: mã, tên, TC, tiên quyết, CLO, ma trận CLO-PLO, học liệu, đánh giá", async () => {
    const d = extractSyllabusByRules(await docxToText(await buildSyllabusDocx()));
    expect(d.code).toBe("TMAE306");
    expect(d.name).toContain("Thương mại điện tử");
    expect(d.credits).toBe(3);
    expect(d.prerequisites).toContain("KTEE201");
    expect(d.clos.map((c) => c.code)).toEqual(["CLO1", "CLO2"]);
    expect(d.cloPlo).toEqual([
      { cloCode: "CLO1", ploCode: "PLO1", level: "2" },
      { cloCode: "CLO2", ploCode: "PLO2", level: "3" },
    ]);
    expect(d.materials).toContain("[TL1]");
    expect(d.content).toContain("Chương 1");
    expect(d.assessmentMethods).toContain("Cuối kỳ 50%");
  });

  it("applyExtractedSyllabus: upsert học phần + đề cương + CLO + liên kết CLO-PLO (idempotent)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      // Tạo CTĐT có PLO1/PLO2 để liên kết được.
      const prog = await createProgramme({ code: "SBI", name: "TMĐT", level: "bachelor", initialVersion: "2026" });
      for (const [i, code] of (["PLO1", "PLO2"] as const).entries()) {
        await prisma.programmeLearningOutcome.create({
          data: { tenantId: t.id, programmeVersionId: prog.versions[0].id, code, description: code, order: i + 1 },
        });
      }
      const data = extractSyllabusByRules(await docxToText(await buildSyllabusDocx()));
      const res = await applyExtractedSyllabus(data);
      expect(res.details.courses).toBe(1);
      expect(res.details.clos).toBe(2);
      expect(res.details.clo_plo).toBe(2);

      const course = await prisma.course.findFirstOrThrow({ where: { code: "TMAE306" }, include: { clos: true } });
      expect(course.prerequisites).toContain("KTEE201");
      expect(course.assessmentMethods).toContain("50%");
      expect(course.clos).toHaveLength(2);
      expect(await prisma.cloPloMapping.count()).toBe(2);

      // Nạp lại: cập nhật, không nhân bản.
      const res2 = await applyExtractedSyllabus(data);
      expect(res2.updated).toBe(1);
      expect(await prisma.courseLearningOutcome.count()).toBe(2);
      expect(await prisma.cloPloMapping.count()).toBe(2);
    });
  });

  it("extractStoredSyllabus: tải file đã lưu trong kho rồi trích xuất (on-demand)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const buf = await buildSyllabusDocx();
      const doc = await createDocument(
        { title: "Đề cương TMAE306", category: "syllabus" },
        { fileName: "tmae306.docx", body: buf, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      );
      const r = await extractStoredSyllabus(doc.id);
      expect(r.documentId).toBe(doc.id);
      expect(r.data.code).toBe("TMAE306");
      expect(r.data.clos.map((c) => c.code)).toEqual(["CLO1", "CLO2"]);
    });
  });

  it("pdfToText: trích được text từ PDF", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Ma hoc phan: TMAE306", { x: 50, y: 700, size: 14, font });
    const text = await pdfToText(Buffer.from(await doc.save()));
    expect(text).toContain("TMAE306");
  });
});
