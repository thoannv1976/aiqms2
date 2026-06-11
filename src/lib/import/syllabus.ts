import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { badRequest, notFound } from "@/lib/http/responses";
import { getStorage } from "@/lib/storage";
import { aiCompleteJson } from "@/lib/ai/service";
import { docxToText } from "./docx";
import type { ImportResult } from "./excel";

// ─── Trích text từ PDF (pdf-parse v2, import động — chỉ tải khi cần) ─────────
export async function pdfToText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const out = await parser.getText();
    return (out.text ?? "").trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// ─── Cấu trúc đề cương trích xuất được ───────────────────────────────────────
const num = z.preprocess(
  (v) => (typeof v === "string" ? parseInt(v.replace(/[^\d]/g, ""), 10) : v),
  z.number().int().optional(),
).optional();

export const extractedSyllabusSchema = z.object({
  code: z.string().default(""),
  name: z.string().default(""),
  nameEn: z.string().optional().default(""),
  credits: num,
  prerequisites: z.string().optional().default(""),
  description: z.string().optional().default(""),
  content: z.string().optional().default(""), // nội dung/kế hoạch giảng dạy (tóm tắt chương/buổi)
  teachingMethods: z.string().optional().default(""),
  assessmentMethods: z.string().optional().default(""),
  materials: z.string().optional().default(""),
  clos: z.array(z.object({ code: z.string(), description: z.string().default("") })).default([]),
  cloPlo: z
    .array(z.object({ cloCode: z.string(), ploCode: z.string(), level: z.string().optional() }))
    .default([]),
});
export type ExtractedSyllabus = z.infer<typeof extractedSyllabusSchema>;

// ─── Trích xuất bằng luật (fallback khi AI tắt) — bám Mẫu 5A/5B của ĐHNT ─────
/** Lấy đoạn văn bản giữa heading bắt đầu và heading kết thúc (theo regex, không phân biệt hoa thường). */
function section(lines: string[], start: RegExp, end: RegExp, maxLines = 40): string {
  const i = lines.findIndex((l) => start.test(l));
  if (i < 0) return "";
  const out: string[] = [];
  for (let j = i + 1; j < lines.length && out.length < maxLines; j++) {
    if (end.test(lines[j])) break;
    if (lines[j]) out.push(lines[j]);
  }
  return out.join("\n").slice(0, 4000);
}

const HEADING = /^(?:PHẦN\s+[A-Z]|[1-9IVX]+\.\s|\d\.\d)/i;

export function extractSyllabusByRules(text: string): ExtractedSyllabus {
  const lines = text.split("\n").map((l) => l.trim());
  const joined = lines.join("\n");

  const code = (joined.match(/M[ãa]\s*(?:h[ọo]c\s*ph[ầa]n)?\s*[:：]\s*([A-Z]{2,4}\d{2,3}[A-Z]?)/i)?.[1]) ?? "";
  const name =
    (joined.match(/T[êe]n\s*h[ọo]c\s*ph[ầa]n\s*[:：]\s*([^\n(]+)/i)?.[1]?.trim()) ??
    (joined.match(/H[ọo]c\s*ph[ầa]n\s*[:：]\s*([^\n(–-]+)/i)?.[1]?.trim()) ?? "";
  const nameEn = (joined.match(/\(([A-Za-z][A-Za-z0-9 ,&'’-]{3,80})\)\s*\n/)?.[1] ?? "").trim();
  const credits = parseInt((joined.match(/S[ốo]\s*t[íi]n\s*ch[ỉi]\s*[:：]?\s*(\d{1,2})/i)?.[1]) ?? "", 10);
  const prerequisites = (joined.match(/(?:Đi[ềe]u\s*ki[ệe]n\s*)?ti[êe]n\s*quy[ếe]t\s*[:：]\s*([^\n]+)/i)?.[1] ?? "").trim();

  const description = section(lines, /^\d?\.?\s*M[ÔO]\s*T[ẢA]\s*H[ỌO]C\s*PH[ẦA]N/i, HEADING, 15);
  const teachingMethods = section(lines, /PH[ƯU][ƠO]NG\s*PH[ÁA]P\s*GI[ẢA]NG\s*D[ẠA]Y/i, HEADING, 12);
  const assessmentMethods = section(lines, /KI[ỂE]M\s*TRA[, ].*Đ[ÁA]NH\s*GI[ÁA]|Đ[ÁA]NH\s*GI[ÁA].*H[ỌO]C\s*PH[ẦA]N/i, /^(?:PHẦN\s+[A-Z]|8\.|9\.)/i, 30);
  const materials = lines.filter((l) => /^\[TL\d+\]/.test(l)).join("\n").slice(0, 4000)
    || section(lines, /^\d?\.?\s*H[ỌO]C\s*LI[ỆE]U/i, /^5[\.\s]|N[ỘO]I\s*DUNG/i, 25);
  // Nội dung: các dòng bắt đầu bằng "Chương N" (khử trùng theo số chương).
  const chapters = new Map<string, string>();
  for (const l of lines) {
    const m = l.match(/Ch[ưu][ơo]ng\s*(\d+)[\s.:]+(.{5,120})/i);
    if (m && !chapters.has(m[1])) chapters.set(m[1], `Chương ${m[1]}. ${m[2].split("\t")[0].trim()}`);
  }
  const content = [...chapters.values()].join("\n").slice(0, 4000);

  // CLO: dòng dạng "CLO1<tab>mô tả..." (bảng 3.1) — bỏ dòng ma trận (giá trị 1/2/3/—).
  const clos: { code: string; description: string }[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    const m = l.match(/^CLO\s*(\d+)\s*[:.\t-]\s*(.+)$/i);
    if (!m || seen.has(m[1])) continue;
    const desc = m[2].split("\t")[0].trim();
    if (desc.length < 15 || /^[\d—\-\s\t]+$/.test(desc)) continue; // dòng ma trận
    seen.add(m[1]);
    clos.push({ code: `CLO${m[1]}`, description: desc });
  }

  // Ma trận CLO–PLO: hàng "CLOn<tab>v1<tab>v2..." sau header có PLO1..PLOn.
  const cloPlo: { cloCode: string; ploCode: string; level?: string }[] = [];
  const headerIdx = lines.findIndex((l) => /CLO\s*[\\/]?\s*PLO|^\s*PLO1\t/i.test(l) && l.includes("PLO"));
  if (headerIdx >= 0) {
    const ploCols = (lines[headerIdx].match(/PLO\d+/g) ?? []);
    for (let j = headerIdx + 1; j < Math.min(headerIdx + 15, lines.length); j++) {
      const cells = lines[j].split("\t").map((c) => c.trim());
      const m = cells[0]?.match(/^CLO\s*(\d+)$/i);
      if (!m) continue;
      cells.slice(1).forEach((v, k) => {
        if (v && v !== "—" && v !== "-" && ploCols[k]) {
          cloPlo.push({ cloCode: `CLO${m[1]}`, ploCode: ploCols[k], level: v });
        }
      });
    }
  }

  return extractedSyllabusSchema.parse({
    code, name, nameEn,
    credits: Number.isNaN(credits) ? undefined : credits,
    prerequisites, description, content, teachingMethods, assessmentMethods, materials,
    clos, cloPlo,
  });
}

/** Rút gọn văn bản gửi AI (đề cương thường < 30 trang nên giữ phần đầu là đủ). */
const condense = (text: string) => text.slice(0, 24000);

// ─── Trích xuất (ưu tiên AI, fallback luật) ──────────────────────────────────
export async function extractSyllabusDoc(
  buffer: Buffer,
  kind: "docx" | "pdf",
): Promise<{ source: "ai" | "rule"; data: ExtractedSyllabus }> {
  const text = kind === "pdf" ? await pdfToText(buffer) : await docxToText(buffer);
  if (!text || text.length < 50) throw badRequest("Không trích xuất được văn bản từ file");
  const ruleData = extractSyllabusByRules(text);

  try {
    const ai = await aiCompleteJson(
      "extract_syllabus",
      [
        {
          role: "system",
          content:
            "Bạn là trợ lý trích xuất ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN đại học từ văn bản. " +
            "Chỉ trích xuất thông tin CÓ trong văn bản, KHÔNG bịa. Trả về JSON thuần.",
        },
        {
          role: "user",
          content:
            "Trích xuất từ đề cương dưới đây thành JSON: " +
            `code (mã học phần, vd TMAE306), name (tên tiếng Việt), nameEn (tên tiếng Anh), credits (số tín chỉ), ` +
            `prerequisites (học phần tiên quyết), description (mô tả học phần, ngắn gọn), ` +
            `content (tóm tắt nội dung theo chương/buổi, mỗi chương 1 dòng), teachingMethods (phương pháp giảng dạy), ` +
            `assessmentMethods (phương pháp + trọng số kiểm tra đánh giá), materials (học liệu: giáo trình + TLTK, mỗi mục 1 dòng), ` +
            `clos: [{code:"CLO1", description}], cloPlo: [{cloCode, ploCode, level}] (ma trận đóng góp CLO–PLO nếu có).\n\n` +
            "===ĐỀ CƯƠNG===\n" + condense(text),
        },
      ],
      extractedSyllabusSchema,
    );
    return {
      source: "ai",
      data: {
        ...ai,
        code: ai.code || ruleData.code,
        name: ai.name || ruleData.name,
        credits: ai.credits ?? ruleData.credits,
        clos: ai.clos.length ? ai.clos : ruleData.clos,
        cloPlo: ai.cloPlo.length ? ai.cloPlo : ruleData.cloPlo,
        materials: ai.materials || ruleData.materials,
        assessmentMethods: ai.assessmentMethods || ruleData.assessmentMethods,
      },
    };
  } catch {
    return { source: "rule", data: ruleData };
  }
}

/** Trích xuất đề cương TỪ MỘT TÀI LIỆU đã upload trong kho (on-demand, không tạo học phần). */
export async function extractStoredSyllabus(documentId: string): Promise<{ source: "ai" | "rule"; data: ExtractedSyllabus; documentId: string; programmeId: string | null }> {
  const doc = await prisma.document.findFirst({ where: { id: documentId } });
  if (!doc) throw notFound("Tài liệu không tồn tại");
  const bytes = await getStorage().get(doc.storageKey);
  if (!bytes) throw badRequest("File không còn trong kho lưu trữ");
  const kind = /\.pdf$/i.test(doc.fileName) ? "pdf" : /\.docx$/i.test(doc.fileName) ? "docx" : null;
  if (!kind) throw badRequest("Chỉ trích xuất được file .docx hoặc .pdf");
  const { source, data } = await extractSyllabusDoc(bytes, kind);
  return { source, data, documentId, programmeId: doc.programmeId };
}

// ─── Ghi vào CSDL: upsert học phần + đề cương + CLO + ma trận CLO–PLO ────────
export async function applyExtractedSyllabus(
  input: ExtractedSyllabus,
  programmeId?: string,
): Promise<ImportResult & { courseId: string }> {
  const ctx = requireTenantContext();
  const data = extractedSyllabusSchema.parse(input);
  const res: ImportResult = { created: 0, updated: 0, errors: [], details: { courses: 0, clos: 0, clo_plo: 0 } };

  if (!data.code) throw badRequest("Thiếu mã học phần — không thể tạo");

  // Course không có cột nameEn — tên tiếng Anh chỉ hiển thị ở bước xem trước.
  const fields = {
    name: data.name || data.code,
    credits: data.credits ?? 3,
    ...(programmeId ? { programmeId } : {}),
    description: data.description || null,
    prerequisites: data.prerequisites || null,
    content: data.content || null,
    teachingMethods: data.teachingMethods || null,
    assessmentMethods: data.assessmentMethods || null,
    materials: data.materials || null,
  };
  let course = await prisma.course.findFirst({ where: { code: data.code, deletedAt: null } });
  if (course) {
    course = await prisma.course.update({ where: { id: course.id }, data: { ...fields, updatedBy: ctx.actorId } });
    res.updated++;
  } else {
    course = await prisma.course.create({ data: withTenantId({ code: data.code, ...fields, createdBy: ctx.actorId }) });
    res.created++; res.details.courses++;
  }

  const cloIdByCode = new Map<string, string>();
  for (const [i, clo] of data.clos.entries()) {
    if (!clo.code) continue;
    const row = await prisma.courseLearningOutcome.upsert({
      where: { courseId_code: { courseId: course.id, code: clo.code } },
      update: { description: clo.description },
      create: withTenantId({ courseId: course.id, code: clo.code, description: clo.description, order: i + 1 }),
    });
    cloIdByCode.set(clo.code, row.id);
    res.details.clos++;
  }

  for (const m of data.cloPlo) {
    const cloId = cloIdByCode.get(m.cloCode);
    if (!cloId) continue;
    const plo = await prisma.programmeLearningOutcome.findFirst({ where: { code: m.ploCode }, orderBy: { createdAt: "desc" } });
    if (!plo) { res.errors.push(`CLO–PLO: không tìm thấy ${m.ploCode} (cần import CTĐT trước)`); continue; }
    await prisma.cloPloMapping.upsert({
      where: { cloId_ploId: { cloId, ploId: plo.id } },
      update: {},
      create: withTenantId({ cloId, ploId: plo.id }),
    });
    res.details.clo_plo++; // mức I/T/U trong file chỉ dùng tham khảo — CloPloMapping lưu liên kết
  }

  await writeAudit({ action: "import.syllabus.doc", entity: "Course", entityId: course.id, meta: res.details });
  return { ...res, courseId: course.id };
}
