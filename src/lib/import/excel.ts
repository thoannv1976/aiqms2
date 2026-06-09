import ExcelJS from "exceljs";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";

export interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
  details: Record<string, number>;
}

// ─── Tiện ích đọc sheet theo tiêu đề cột (không phụ thuộc thứ tự cột) ─────────
type Row = Record<string, string>;
function readRows(ws?: ExcelJS.Worksheet): Row[] {
  if (!ws) return [];
  const headers: Record<number, string> = {};
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? "").trim().toLowerCase();
  });
  const out: Row[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Row = {};
    let any = false;
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (!key) return;
      const v = cell.value;
      const text = v == null ? "" : typeof v === "object" && "text" in (v as object) ? String((v as { text: string }).text) : String(v);
      obj[key] = text.trim();
      if (obj[key]) any = true;
    });
    if (any) out.push(obj);
  }
  return out;
}
function pick(row: Row, keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k];
  return "";
}
function toInt(s: string): number | undefined {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? undefined : n;
}
function mapLevel(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("thạc") || v.includes("master")) return "master";
  if (v.includes("tiến") || v.includes("doctor") || v.includes("phd")) return "doctor";
  return "bachelor";
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Bộ từ khóa tiêu đề chấp nhận (lowercase)
const COL = {
  // Mã CTĐT (cột "Mã CTĐT" của sheet ChuongTrinh và cột tham chiếu ở PEO/PLO)
  progCode: ["mã ctđt", "mã ctdt", "ma ctdt", "mã chương trình", "programmecode", "code"],
  // Mã của PEO/PLO/CLO (cột "Mã") — KHÔNG trùng với "Mã CTĐT"/"Mã học phần"
  outcomeCode: ["mã", "ma", "mã plo", "mã peo", "mã clo"],
  name: ["tên chương trình", "tên học phần", "tên", "ten", "name"],
  nameEn: ["tên tiếng anh", "name_en", "nameen", "english name"],
  level: ["trình độ", "trinh do", "level"],
  credits: ["tổng tín chỉ", "tín chỉ", "tin chi", "credits", "số tín chỉ"],
  version: ["phiên bản", "phien ban", "version"],
  desc: ["mô tả", "mo ta", "description", "nội dung", "diễn giải"],
  courseCode: ["mã học phần", "mã hp", "ma hoc phan", "coursecode", "mã"],
  prerequisites: ["học phần tiên quyết", "tiên quyết", "prerequisites"],
  content: ["nội dung giảng dạy", "nội dung", "content"],
  teaching: ["phương pháp giảng dạy", "pp giảng dạy", "teaching", "teachingmethods"],
  assessment: ["phương pháp đánh giá", "pp đánh giá", "assessment", "assessmentmethods"],
  materials: ["tài liệu", "tài liệu học tập", "materials"],
  rubric: ["rubric", "tiêu chí chấm"],
};

// ─── Import CHƯƠNG TRÌNH ĐÀO TẠO ─────────────────────────────────────────────
export async function importProgrammes(buffer: Buffer): Promise<ImportResult> {
  const ctx = requireTenantContext();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const res: ImportResult = { created: 0, updated: 0, errors: [], details: { programmes: 0, peos: 0, plos: 0 } };

  const codeToVersion = new Map<string, string>();

  const progRows = readRows(wb.getWorksheet("ChuongTrinh") ?? wb.worksheets[0]);
  for (const [i, row] of progRows.entries()) {
    try {
      const code = pick(row, COL.progCode);
      if (!code) continue;
      const name = pick(row, COL.name) || code;
      const version = pick(row, COL.version) || "2024";
      let prog = await prisma.programme.findFirst({ where: { code, deletedAt: null }, include: { versions: true } });
      if (!prog) {
        prog = await prisma.programme.create({
          data: withTenantId({
            code, name, nameEn: pick(row, COL.nameEn) || null, level: mapLevel(pick(row, COL.level)),
            totalCredits: toInt(pick(row, COL.credits)) ?? null, createdBy: ctx.actorId,
            versions: { create: withTenantId({ version, status: "draft", createdBy: ctx.actorId }) },
          }) as Prisma.ProgrammeUncheckedCreateInput,
          include: { versions: true },
        });
        res.created++; res.details.programmes++;
      } else {
        res.updated++;
      }
      let ver = prog.versions.find((v) => v.version === version) ?? prog.versions[0];
      if (!ver) {
        ver = await prisma.programmeVersion.create({ data: withTenantId({ programmeId: prog.id, version, status: "draft", createdBy: ctx.actorId }) });
      }
      codeToVersion.set(code, ver.id);
    } catch (e) {
      res.errors.push(`CTĐT dòng ${i + 2}: ${msg(e)}`);
    }
  }

  async function versionOf(progCode: string): Promise<string | null> {
    if (codeToVersion.has(progCode)) return codeToVersion.get(progCode)!;
    const prog = await prisma.programme.findFirst({ where: { code: progCode, deletedAt: null }, include: { versions: true } });
    const v = prog?.versions[0];
    if (v) codeToVersion.set(progCode, v.id);
    return v?.id ?? null;
  }

  for (const [i, row] of readRows(wb.getWorksheet("PEO")).entries()) {
    try {
      const pc = pick(row, COL.progCode); const code = pick(row, COL.outcomeCode); const desc = pick(row, COL.desc);
      if (!pc || !code) continue;
      const versionId = await versionOf(pc);
      if (!versionId) { res.errors.push(`PEO dòng ${i + 2}: không tìm thấy CTĐT '${pc}'`); continue; }
      await prisma.programmeObjective.upsert({
        where: { programmeVersionId_code: { programmeVersionId: versionId, code } },
        update: { description: desc },
        create: withTenantId({ programmeVersionId: versionId, code, description: desc, order: i + 1 }),
      });
      res.details.peos++;
    } catch (e) { res.errors.push(`PEO dòng ${i + 2}: ${msg(e)}`); }
  }

  for (const [i, row] of readRows(wb.getWorksheet("PLO")).entries()) {
    try {
      const pc = pick(row, COL.progCode); const code = pick(row, COL.outcomeCode); const desc = pick(row, COL.desc);
      if (!pc || !code) continue;
      const versionId = await versionOf(pc);
      if (!versionId) { res.errors.push(`PLO dòng ${i + 2}: không tìm thấy CTĐT '${pc}'`); continue; }
      await prisma.programmeLearningOutcome.upsert({
        where: { programmeVersionId_code: { programmeVersionId: versionId, code } },
        update: { description: desc },
        create: withTenantId({ programmeVersionId: versionId, code, description: desc, order: i + 1 }),
      });
      res.details.plos++;
    } catch (e) { res.errors.push(`PLO dòng ${i + 2}: ${msg(e)}`); }
  }

  await writeAudit({ action: "import.programmes", entity: "Programme", meta: res.details });
  return res;
}

// ─── Import ĐỀ CƯƠNG HỌC PHẦN ────────────────────────────────────────────────
export async function importCourses(buffer: Buffer): Promise<ImportResult> {
  const ctx = requireTenantContext();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const res: ImportResult = { created: 0, updated: 0, errors: [], details: { courses: 0, clos: 0 } };

  const courseRows = readRows(wb.getWorksheet("HocPhan") ?? wb.worksheets[0]);
  for (const [i, row] of courseRows.entries()) {
    try {
      const code = pick(row, COL.courseCode);
      if (!code) continue;
      const data = {
        name: pick(row, COL.name) || code,
        credits: toInt(pick(row, COL.credits)) ?? 3,
        description: pick(row, COL.desc) || null,
        prerequisites: pick(row, COL.prerequisites) || null,
        content: pick(row, COL.content) || null,
        teachingMethods: pick(row, COL.teaching) || null,
        assessmentMethods: pick(row, COL.assessment) || null,
        materials: pick(row, COL.materials) || null,
        rubric: pick(row, COL.rubric) || null,
      };
      const existing = await prisma.course.findFirst({ where: { code, deletedAt: null } });
      if (existing) {
        await prisma.course.update({ where: { id: existing.id }, data: { ...data, updatedBy: ctx.actorId } });
        res.updated++;
      } else {
        await prisma.course.create({ data: withTenantId({ code, ...data, createdBy: ctx.actorId }) });
        res.created++; res.details.courses++;
      }
    } catch (e) { res.errors.push(`Học phần dòng ${i + 2}: ${msg(e)}`); }
  }

  for (const [i, row] of readRows(wb.getWorksheet("CLO")).entries()) {
    try {
      const cc = pick(row, COL.courseCode); const code = pick(row, COL.outcomeCode); const desc = pick(row, COL.desc);
      if (!cc || !code) continue;
      const course = await prisma.course.findFirst({ where: { code: cc, deletedAt: null } });
      if (!course) { res.errors.push(`CLO dòng ${i + 2}: không tìm thấy học phần '${cc}'`); continue; }
      await prisma.courseLearningOutcome.upsert({
        where: { courseId_code: { courseId: course.id, code } },
        update: { description: desc },
        create: withTenantId({ courseId: course.id, code, description: desc, order: i + 1 }),
      });
      res.details.clos++;
    } catch (e) { res.errors.push(`CLO dòng ${i + 2}: ${msg(e)}`); }
  }

  await writeAudit({ action: "import.courses", entity: "Course", meta: res.details });
  return res;
}

// ─── File mẫu (template) ─────────────────────────────────────────────────────
function styleHeader(ws: ExcelJS.Worksheet, headers: string[]) {
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 26));
}

export async function programmeTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("ChuongTrinh");
  styleHeader(s1, ["Mã CTĐT", "Tên chương trình", "Tên tiếng Anh", "Trình độ", "Tổng tín chỉ", "Phiên bản"]);
  s1.addRow(["7480201", "Công nghệ thông tin", "Information Technology", "Đại học", 130, "2024"]);
  const s2 = wb.addWorksheet("PEO");
  styleHeader(s2, ["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"]);
  s2.addRow(["7480201", "2024", "PEO1", "Mục tiêu 1…"]);
  const s3 = wb.addWorksheet("PLO");
  styleHeader(s3, ["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"]);
  s3.addRow(["7480201", "2024", "PLO1", "Chuẩn đầu ra 1…"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function courseTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("HocPhan");
  styleHeader(s1, ["Mã học phần", "Tên học phần", "Số tín chỉ", "Mô tả", "Học phần tiên quyết", "Nội dung giảng dạy", "Phương pháp giảng dạy", "Phương pháp đánh giá", "Tài liệu", "Rubric"]);
  s1.addRow(["CS101", "Nhập môn lập trình", 3, "Mô tả…", "", "Biến, hàm, mảng…", "Thuyết giảng + dự án", "Giữa kỳ 40% + cuối kỳ 60%", "Giáo trình A", ""]);
  const s2 = wb.addWorksheet("CLO");
  styleHeader(s2, ["Mã học phần", "Mã", "Mô tả"]);
  s2.addRow(["CS101", "CLO1", "Viết được chương trình cơ bản"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
