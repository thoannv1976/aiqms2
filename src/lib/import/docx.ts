import JSZip from "jszip";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { badRequest } from "@/lib/http/responses";
import { aiCompleteJson } from "@/lib/ai/service";
import type { ImportResult } from "./excel";

// ─── 1) Trích xuất văn bản thuần từ .docx (không phụ thuộc thư viện nặng) ─────
/** Đọc word/document.xml, giữ ngắt đoạn (</w:p>), ô bảng (</w:tc> -> tab) và hàng (</w:tr>). */
export async function docxToText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer).catch(() => null);
  if (!zip) throw badRequest("File .docx không hợp lệ");
  const doc = zip.file("word/document.xml");
  if (!doc) throw badRequest("Không đọc được nội dung Word (thiếu document.xml)");
  let xml = await doc.async("string");
  xml = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, ""); // bỏ mọi thẻ còn lại, giữ phần text
  const text = xml
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x?[0-9A-Fa-f]+;/g, " ")
    .replace(/\n+[ \t]*\t/g, "\t") // ngắt đoạn ngay trước ranh giới ô bảng -> gộp vào tab
    .replace(/\t{2,}/g, "\t")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

// ─── 2) Dữ liệu CTĐT trích xuất được (chuẩn hóa) ─────────────────────────────
const num = z.preprocess(
  (v) => (typeof v === "string" ? parseInt(v.replace(/[^\d]/g, ""), 10) : v),
  z.number().int().optional(),
).optional();

export const extractedProgrammeSchema = z.object({
  code: z.string().default(""),
  name: z.string().default(""),
  nameEn: z.string().optional().default(""),
  level: z.string().optional().default("bachelor"),
  totalCredits: num,
  version: z.string().optional().default(""),
  peos: z.array(z.object({ code: z.string(), description: z.string().default("") })).default([]),
  plos: z.array(z.object({ code: z.string(), description: z.string().default("") })).default([]),
  courses: z.array(z.object({ code: z.string(), name: z.string().default(""), credits: num })).default([]),
});
export type ExtractedProgramme = z.infer<typeof extractedProgrammeSchema>;

const COURSE_CODE = /\b([A-Z]{2,4}\d{2,3}[A-Z]?)\b/;

function mapLevel(s: string): string {
  const v = (s || "").toLowerCase();
  if (v.includes("thạc") || v.includes("master")) return "master";
  if (v.includes("tiến") || v.includes("doctor") || v.includes("phd")) return "doctor";
  return "bachelor";
}

/** Trích xuất bằng luật (fallback khi AI tắt): tên/mã CTĐT, PLO, PEO và mã học phần. */
export function extractByRules(text: string): ExtractedProgramme {
  const lines = text.split("\n").map((l) => l.trim());
  const joined = lines.join("\n");

  const code = (joined.match(/M[ãa]\s*(?:ng[àa]nh|s[ốo])\s*[:.]?\s*([0-9]{6,7})/i)?.[1]) ?? "";
  let name = "";
  for (let i = 0; i < lines.length; i++) {
    if (/T[êe]n\s+(?:ng[àa]nh|chương tr[ìi]nh)/i.test(lines[i])) {
      const inline = lines[i].split(/[:：]/).slice(1).join(":").trim();
      name = inline || lines[i + 1] || "";
      if (name) break;
    }
  }
  const totalCredits = parseInt(
    (joined.match(/T[ổo]ng\s+s[ốo]\s+t[íi]n\s+ch[ỉi][^\d]{0,20}(\d{2,3})/i)?.[1]) ?? "",
    10,
  );

  const peos: { code: string; description: string }[] = [];
  const plos: { code: string; description: string }[] = [];
  for (const l of lines) {
    const peo = l.match(/^PEO\s*(\d+)\s*[:.)-]?\s*(.+)$/i);
    if (peo && peo[2].length > 8) peos.push({ code: `PEO${peo[1]}`, description: peo[2].trim() });
    const plo = l.match(/^PLO\s*(\d+)\s*[:.)-]?\s*(.+)$/i);
    if (plo && plo[2].length > 8) plos.push({ code: `PLO${plo[1]}`, description: plo[2].trim() });
  }

  // Học phần: dòng (thường là hàng bảng tách bằng tab) có mã học phần + một số tín chỉ nhỏ.
  const courses: { code: string; name: string; credits?: number }[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    const m = l.match(COURSE_CODE);
    if (!m) continue;
    const cc = m[1];
    if (seen.has(cc)) continue;
    const cells = l.split("\t").map((c) => c.trim()).filter(Boolean);
    const nameCell = cells.find((c) => c !== cc && !/^\d{1,3}$/.test(c) && c.length > 3 && !COURSE_CODE.test(c)) ?? "";
    const creditCell = cells.reverse().find((c) => /^\d{1,2}$/.test(c));
    seen.add(cc);
    courses.push({ code: cc, name: nameCell, credits: creditCell ? Number(creditCell) : undefined });
  }

  return extractedProgrammeSchema.parse({
    code,
    name,
    level: "bachelor",
    totalCredits: Number.isNaN(totalCredits) ? undefined : totalCredits,
    peos: dedupeByCode(peos),
    plos: dedupeByCode(plos),
    courses,
  });
}

function dedupeByCode<T extends { code: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => (seen.has(x.code) ? false : (seen.add(x.code), true)));
}

/** Rút gọn văn bản gửi cho AI: phần đầu (mô tả + PLO/PEO) + gom các dòng có mã học phần. */
function condenseForAi(text: string): string {
  const head = text.slice(0, 12000);
  const courseLines = text
    .split("\n")
    .filter((l) => COURSE_CODE.test(l))
    .slice(0, 400)
    .join("\n");
  return `${head}\n\n[CÁC DÒNG CÓ MÃ HỌC PHẦN]\n${courseLines}`.slice(0, 22000);
}

// ─── 3) Trích xuất CTĐT (ưu tiên AI, fallback luật) ──────────────────────────
export async function extractProgrammeDoc(
  buffer: Buffer,
): Promise<{ source: "ai" | "rule"; data: ExtractedProgramme }> {
  const text = await docxToText(buffer);
  const ruleData = extractByRules(text);

  try {
    const ai = await aiCompleteJson(
      "extract_programme",
      [
        {
          role: "system",
          content:
            "Bạn là trợ lý trích xuất dữ liệu chương trình đào tạo (CTĐT) đại học từ văn bản. " +
            "Chỉ trích xuất thông tin CÓ trong văn bản, KHÔNG bịa. Trả về JSON thuần đúng cấu trúc.",
        },
        {
          role: "user",
          content:
            "Trích xuất từ tài liệu CTĐT dưới đây thành JSON với các trường: " +
            `code (mã ngành, vd 7340122), name (tên ngành/chương trình tiếng Việt), nameEn (tên tiếng Anh nếu có), ` +
            `level ("bachelor"|"master"|"doctor"), totalCredits (tổng tín chỉ, số nguyên), ` +
            `peos: [{code:"PEO1", description}], plos: [{code:"PLO1", description}], ` +
            `courses: [{code (mã học phần), name (tên học phần), credits (số tín chỉ)}]. ` +
            "Bỏ qua hàng tiêu đề/tổng cộng trong bảng học phần.\n\n===TÀI LIỆU===\n" +
            condenseForAi(text),
        },
      ],
      extractedProgrammeSchema,
    );
    // AI ưu tiên; nếu AI bỏ sót PLO/courses thì bù bằng kết quả luật.
    return {
      source: "ai",
      data: {
        ...ai,
        code: ai.code || ruleData.code,
        name: ai.name || ruleData.name,
        plos: ai.plos.length ? ai.plos : ruleData.plos,
        peos: ai.peos.length ? ai.peos : ruleData.peos,
        courses: ai.courses.length ? ai.courses : ruleData.courses,
      },
    };
  } catch {
    // AI tắt / không có khóa / lỗi -> dùng kết quả luật.
    return { source: "rule", data: ruleData };
  }
}

// ─── 4) Ghi dữ liệu đã duyệt vào CSDL (upsert CTĐT + phiên bản + PEO/PLO + học phần) ──
export async function applyExtractedProgramme(input: ExtractedProgramme): Promise<ImportResult> {
  const ctx = requireTenantContext();
  const data = extractedProgrammeSchema.parse(input);
  const res: ImportResult = { created: 0, updated: 0, errors: [], details: { programmes: 0, peos: 0, plos: 0, courses: 0 } };

  if (!data.code) throw badRequest("Thiếu mã CTĐT — không thể tạo chương trình");
  const version = data.version || String(new Date().getFullYear());

  let prog = await prisma.programme.findFirst({ where: { code: data.code, deletedAt: null }, include: { versions: true } });
  if (!prog) {
    prog = await prisma.programme.create({
      data: withTenantId({
        code: data.code,
        name: data.name || data.code,
        nameEn: data.nameEn || null,
        level: mapLevel(data.level),
        totalCredits: data.totalCredits ?? null,
        createdBy: ctx.actorId,
        versions: { create: withTenantId({ version, status: "draft", createdBy: ctx.actorId }) },
      }) as Prisma.ProgrammeUncheckedCreateInput,
      include: { versions: true },
    });
    res.created++; res.details.programmes++;
  } else {
    await prisma.programme.update({
      where: { id: prog.id },
      data: { name: data.name || prog.name, nameEn: data.nameEn || prog.nameEn, totalCredits: data.totalCredits ?? prog.totalCredits, updatedBy: ctx.actorId },
    });
    res.updated++;
  }
  let ver = prog.versions.find((v) => v.version === version) ?? prog.versions[0];
  if (!ver) ver = await prisma.programmeVersion.create({ data: withTenantId({ programmeId: prog.id, version, status: "draft", createdBy: ctx.actorId }) });

  for (const [i, peo] of data.peos.entries()) {
    if (!peo.code) continue;
    await prisma.programmeObjective.upsert({
      where: { programmeVersionId_code: { programmeVersionId: ver.id, code: peo.code } },
      update: { description: peo.description },
      create: withTenantId({ programmeVersionId: ver.id, code: peo.code, description: peo.description, order: i + 1 }),
    });
    res.details.peos++;
  }
  for (const [i, plo] of data.plos.entries()) {
    if (!plo.code) continue;
    await prisma.programmeLearningOutcome.upsert({
      where: { programmeVersionId_code: { programmeVersionId: ver.id, code: plo.code } },
      update: { description: plo.description },
      create: withTenantId({ programmeVersionId: ver.id, code: plo.code, description: plo.description, order: i + 1 }),
    });
    res.details.plos++;
  }
  for (const c of data.courses) {
    if (!c.code) continue;
    const existing = await prisma.course.findFirst({ where: { code: c.code, deletedAt: null } });
    if (existing) {
      if (c.name) await prisma.course.update({ where: { id: existing.id }, data: { name: c.name, updatedBy: ctx.actorId } });
    } else {
      await prisma.course.create({ data: withTenantId({ code: c.code, name: c.name || c.code, credits: c.credits ?? 3, createdBy: ctx.actorId }) });
      res.details.courses++;
    }
  }

  await writeAudit({ action: "import.programme.docx", entity: "Programme", entityId: prog.id, meta: res.details });
  return res;
}
