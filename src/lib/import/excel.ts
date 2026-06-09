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
/** Như pick() nhưng nếu không khớp chính xác thì dò theo chuỗi con của tiêu đề cột
 *  (vd: tiêu đề "Mức (I/R/M)" khớp từ khóa "mức"). Dùng cho các sheet có tiêu đề tự do. */
function pickLike(row: Row, keys: string[]): string {
  const exact = pick(row, keys);
  if (exact) return exact;
  for (const rk of Object.keys(row)) {
    if (row[rk] && keys.some((k) => rk.includes(k))) return row[rk];
  }
  return "";
}
function toInt(s: string): number | undefined {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? undefined : n;
}
function toFloat(s: string): number | undefined {
  const n = parseFloat(s.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
}
function mapLevel(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("thạc") || v.includes("master")) return "master";
  if (v.includes("tiến") || v.includes("doctor") || v.includes("phd")) return "doctor";
  return "bachelor";
}
/** Mức độ phủ I/R/M (Introduce/Reinforce/Master) — chấp nhận cả nhãn tiếng Việt. */
function mapIRM(s: string): "I" | "R" | "M" {
  const v = s.trim().toUpperCase();
  if (v.startsWith("R") || v.includes("CỦNG")) return "R";
  if (v.startsWith("M") || v.includes("THÀNH") || v.includes("THẠO")) return "M";
  return "I";
}
/** Khớp giá trị enum: nếu khớp đúng giá trị trả về luôn; nếu không, dò theo từ khóa tiếng Việt. */
function mapEnum(raw: string, table: [string, string[]][], fallback: string): string {
  const v = raw.trim().toLowerCase();
  for (const [value] of table) if (v === value) return value;
  for (const [value, kws] of table) if (kws.some((k) => v.includes(k))) return value;
  return fallback;
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

// ─── Import MA TRẬN PLO–học phần & CLO–PLO ───────────────────────────────────
const MCOL = {
  ploCode: ["mã plo", "ma plo", "plo"],
  cloCode: ["mã clo", "ma clo", "clo"],
  courseCode: ["mã học phần", "mã hp", "ma hoc phan", "học phần", "coursecode"],
  level: ["mức", "muc", "mức độ", "muc do", "level", "i/r/m", "i-r-m"],
};

export async function importMatrix(buffer: Buffer): Promise<ImportResult> {
  const pick = pickLike; // sheet tiêu đề tự do -> dò theo chuỗi con
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const res: ImportResult = { created: 0, updated: 0, errors: [], details: { plo_course: 0, clo_plo: 0 } };

  // PLO ↔ học phần (mức I/R/M)
  const sheetPC = wb.getWorksheet("MaTranPLO") ?? wb.getWorksheet("PLO_HocPhan") ?? wb.worksheets[0];
  for (const [i, row] of readRows(sheetPC).entries()) {
    try {
      const ploCode = pick(row, MCOL.ploCode);
      const courseCode = pick(row, MCOL.courseCode);
      if (!ploCode || !courseCode) continue;
      const plo = await prisma.programmeLearningOutcome.findFirst({ where: { code: ploCode }, orderBy: { createdAt: "desc" } });
      if (!plo) { res.errors.push(`Ma trận PLO dòng ${i + 2}: không tìm thấy PLO '${ploCode}'`); continue; }
      const course = await prisma.course.findFirst({ where: { code: courseCode, deletedAt: null } });
      if (!course) { res.errors.push(`Ma trận PLO dòng ${i + 2}: không tìm thấy học phần '${courseCode}'`); continue; }
      await prisma.ploCourseMapping.upsert({
        where: { ploId_courseId: { ploId: plo.id, courseId: course.id } },
        update: { level: mapIRM(pick(row, MCOL.level)) },
        create: withTenantId({ ploId: plo.id, courseId: course.id, level: mapIRM(pick(row, MCOL.level)) }),
      });
      res.details.plo_course++; res.created++;
    } catch (e) { res.errors.push(`Ma trận PLO dòng ${i + 2}: ${msg(e)}`); }
  }

  // CLO ↔ PLO
  for (const [i, row] of readRows(wb.getWorksheet("CLO_PLO")).entries()) {
    try {
      const courseCode = pick(row, MCOL.courseCode);
      const cloCode = pick(row, MCOL.cloCode);
      const ploCode = pick(row, MCOL.ploCode);
      if (!cloCode || !ploCode) continue;
      const course = courseCode ? await prisma.course.findFirst({ where: { code: courseCode, deletedAt: null } }) : null;
      const clo = await prisma.courseLearningOutcome.findFirst({
        where: { code: cloCode, ...(course ? { courseId: course.id } : {}) },
        orderBy: { createdAt: "desc" },
      });
      if (!clo) { res.errors.push(`CLO-PLO dòng ${i + 2}: không tìm thấy CLO '${cloCode}'`); continue; }
      const plo = await prisma.programmeLearningOutcome.findFirst({ where: { code: ploCode }, orderBy: { createdAt: "desc" } });
      if (!plo) { res.errors.push(`CLO-PLO dòng ${i + 2}: không tìm thấy PLO '${ploCode}'`); continue; }
      await prisma.cloPloMapping.upsert({
        where: { cloId_ploId: { cloId: clo.id, ploId: plo.id } },
        update: {},
        create: withTenantId({ cloId: clo.id, ploId: plo.id }),
      });
      res.details.clo_plo++; res.created++;
    } catch (e) { res.errors.push(`CLO-PLO dòng ${i + 2}: ${msg(e)}`); }
  }

  await writeAudit({ action: "import.matrix", entity: "PloCourseMapping", meta: res.details });
  return res;
}

// ─── Import DỮ LIỆU C5–C8 (đội ngũ / người học / CSVC / kết quả) ──────────────
const ICOL = {
  fullName: ["họ tên", "ho ten", "tên", "fullname", "name"],
  rank: ["học hàm", "hoc ham", "rank"],
  degree: ["học vị", "hoc vi", "degree"],
  spec: ["chuyên môn", "chuyen mon", "specialization"],
  position: ["vị trí", "vi tri", "chức vụ", "position"],
  publications: ["số công bố", "công bố", "publications"],
  fte: ["fte", "quy đổi", "toàn thời gian"],
  empType: ["hình thức", "hinh thuc", "employmenttype"],
  gender: ["giới tính", "gioi tinh", "gender"],
  recruitedYear: ["năm tuyển dụng", "nam tuyen dung", "recruitedyear"],
  training: ["bồi dưỡng", "boi duong", "phát triển", "training"],
  category: ["nhóm", "nhom", "loại", "loai", "phân loại", "category"],
  title: ["nội dung", "tiêu đề", "tên dịch vụ", "tên", "title", "name", "chỉ số", "tên chỉ số"],
  academicYear: ["năm học", "nam hoc", "academicyear"],
  metricValue: ["chỉ số", "chi so", "metricvalue", "giá trị số"],
  targetGroup: ["đối tượng", "doi tuong", "targetgroup"],
  respUnit: ["đơn vị", "don vi", "đơn vị phụ trách", "responsibleunit"],
  beneficiaries: ["số người", "người hưởng lợi", "beneficiaries"],
  facName: ["tên", "ten", "name"],
  facType: ["loại", "loai", "type"],
  facCode: ["mã", "ma", "code"],
  quantity: ["số lượng", "so luong", "quantity"],
  capacity: ["sức chứa", "suc chua", "capacity"],
  area: ["diện tích", "dien tich", "area", "m2", "m²"],
  condition: ["tình trạng", "tinh trang", "condition"],
  utilization: ["tỷ lệ sử dụng", "ty le su dung", "utilizationrate"],
  usableYear: ["năm sử dụng", "nam su dung", "usableyear"],
  location: ["vị trí", "vi tri", "location"],
  value: ["giá trị", "gia tri", "value"],
  unit: ["đơn vị tính", "don vi tinh", "unit"],
  target: ["mục tiêu", "muc tieu", "target"],
  benchmark: ["đối sánh", "doi sanh", "benchmark", "mốc"],
  cohort: ["khóa", "khoa", "cohort"],
  dataSource: ["nguồn", "nguon", "datasource", "nguồn dữ liệu"],
};

export async function importInstitutional(buffer: Buffer): Promise<ImportResult> {
  const pick = pickLike; // sheet tiêu đề tự do -> dò theo chuỗi con
  const ctx = requireTenantContext();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const res: ImportResult = { created: 0, updated: 0, errors: [], details: { staff: 0, students: 0, facilities: 0, outcomes: 0 } };

  // C5 — Đội ngũ giảng viên
  for (const [i, row] of readRows(wb.getWorksheet("C5_GiangVien")).entries()) {
    try {
      const fullName = pick(row, ICOL.fullName);
      if (!fullName) continue;
      if (await prisma.academicStaff.findFirst({ where: { fullName, deletedAt: null } })) continue;
      await prisma.academicStaff.create({ data: withTenantId({
        fullName, academicRank: pick(row, ICOL.rank) || null, degree: pick(row, ICOL.degree) || null,
        specialization: pick(row, ICOL.spec) || null, position: pick(row, ICOL.position) || null,
        publications: toInt(pick(row, ICOL.publications)) ?? 0, fte: toFloat(pick(row, ICOL.fte)) ?? null,
        employmentType: pick(row, ICOL.empType) ? mapEnum(pick(row, ICOL.empType), [["full_time", ["toàn", "full", "cơ hữu"]], ["part_time", ["bán", "part", "thỉnh"]], ["visiting", ["mời", "visiting", "kiêm"]]], "full_time") : null,
        gender: pick(row, ICOL.gender) ? mapEnum(pick(row, ICOL.gender), [["male", ["nam", "male"]], ["female", ["nữ", "female"]]], "other") : null,
        recruitedYear: toInt(pick(row, ICOL.recruitedYear)) ?? null, trainingActivities: pick(row, ICOL.training) || null,
        createdBy: ctx.actorId,
      }) });
      res.details.staff++; res.created++;
    } catch (e) { res.errors.push(`C5 dòng ${i + 2}: ${msg(e)}`); }
  }

  // C6 — Người học & hỗ trợ
  for (const [i, row] of readRows(wb.getWorksheet("C6_NguoiHoc")).entries()) {
    try {
      const title = pick(row, ICOL.title);
      if (!title) continue;
      if (await prisma.studentService.findFirst({ where: { title, deletedAt: null } })) continue;
      const category = mapEnum(pick(row, ICOL.category), [
        ["admission", ["tuyển sinh", "admission"]], ["advising", ["cố vấn", "advising"]], ["scholarship", ["học bổng", "scholarship"]],
        ["internship", ["thực tập", "internship"]], ["career", ["việc làm", "hướng nghiệp", "career"]], ["extracurricular", ["ngoại khóa", "extracurricular"]],
      ], "support");
      await prisma.studentService.create({ data: withTenantId({
        category, title, description: pick(row, COL.desc) || null, academicYear: pick(row, ICOL.academicYear) || null,
        metricValue: toFloat(pick(row, ICOL.metricValue)) ?? null, targetGroup: pick(row, ICOL.targetGroup) || null,
        responsibleUnit: pick(row, ICOL.respUnit) || null, beneficiaries: toInt(pick(row, ICOL.beneficiaries)) ?? null,
        createdBy: ctx.actorId,
      }) });
      res.details.students++; res.created++;
    } catch (e) { res.errors.push(`C6 dòng ${i + 2}: ${msg(e)}`); }
  }

  // C7 — Cơ sở vật chất
  for (const [i, row] of readRows(wb.getWorksheet("C7_CoSoVatChat")).entries()) {
    try {
      const name = pick(row, ICOL.facName);
      if (!name) continue;
      if (await prisma.facility.findFirst({ where: { name, deletedAt: null } })) continue;
      const type = mapEnum(pick(row, ICOL.facType), [
        ["classroom", ["phòng học", "giảng đường", "classroom"]], ["lab", ["lab", "thí nghiệm", "phòng máy"]], ["library", ["thư viện", "library"]],
        ["it", ["cntt", "hạ tầng", "mạng", "it"]], ["software", ["phần mềm", "software"]], ["equipment", ["thiết bị", "equipment"]],
      ], "space");
      await prisma.facility.create({ data: withTenantId({
        name, type, code: pick(row, ICOL.facCode) || null, quantity: toInt(pick(row, ICOL.quantity)) ?? null,
        capacity: toInt(pick(row, ICOL.capacity)) ?? null, area: toFloat(pick(row, ICOL.area)) ?? null,
        condition: pick(row, ICOL.condition) ? mapEnum(pick(row, ICOL.condition), [["good", ["tốt", "good"]], ["fair", ["trung", "fair"]], ["poor", ["kém", "poor"]]], "good") : null,
        utilizationRate: toFloat(pick(row, ICOL.utilization)) ?? null, usableYear: toInt(pick(row, ICOL.usableYear)) ?? null,
        location: pick(row, ICOL.location) || null, createdBy: ctx.actorId,
      }) });
      res.details.facilities++; res.created++;
    } catch (e) { res.errors.push(`C7 dòng ${i + 2}: ${msg(e)}`); }
  }

  // C8 — Kết quả đầu ra
  for (const [i, row] of readRows(wb.getWorksheet("C8_KetQua")).entries()) {
    try {
      const name = pick(row, ICOL.title);
      if (!name) continue;
      const academicYear = pick(row, ICOL.academicYear) || null;
      if (await prisma.outcomeMetric.findFirst({ where: { name, academicYear, deletedAt: null } })) continue;
      const category = mapEnum(pick(row, ICOL.category), [
        ["graduation", ["tốt nghiệp", "graduation"]], ["employment", ["việc làm", "employment"]], ["satisfaction", ["hài lòng", "satisfaction"]],
        ["plo_attainment", ["plo", "đạt chuẩn"]], ["research", ["nghiên cứu", "research"]],
      ], "other");
      await prisma.outcomeMetric.create({ data: withTenantId({
        name, category, academicYear, value: toFloat(pick(row, ICOL.value)) ?? null, unit: pick(row, ICOL.unit) || null,
        target: toFloat(pick(row, ICOL.target)) ?? null, benchmark: toFloat(pick(row, ICOL.benchmark)) ?? null,
        cohort: pick(row, ICOL.cohort) || null, dataSource: pick(row, ICOL.dataSource) || null, createdBy: ctx.actorId,
      }) });
      res.details.outcomes++; res.created++;
    } catch (e) { res.errors.push(`C8 dòng ${i + 2}: ${msg(e)}`); }
  }

  await writeAudit({ action: "import.institutional", entity: "AcademicStaff", meta: res.details });
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

export async function matrixTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("MaTranPLO");
  styleHeader(s1, ["Mã PLO", "Mã học phần", "Mức (I/R/M)"]);
  s1.addRow(["PLO1", "CS101", "I"]);
  s1.addRow(["PLO1", "CS201", "R"]);
  const s2 = wb.addWorksheet("CLO_PLO");
  styleHeader(s2, ["Mã học phần", "Mã CLO", "Mã PLO"]);
  s2.addRow(["CS101", "CLO1", "PLO1"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function institutionalTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const s5 = wb.addWorksheet("C5_GiangVien");
  styleHeader(s5, ["Họ tên", "Học hàm", "Học vị", "Chuyên môn", "Vị trí", "Số công bố", "FTE", "Hình thức", "Giới tính", "Năm tuyển dụng", "Bồi dưỡng"]);
  s5.addRow(["Nguyễn Văn A", "PGS", "TS", "Thương mại điện tử", "Trưởng bộ môn", 12, 1, "Toàn thời gian", "Nam", 2018, "Tập huấn AUN-QA 2024"]);
  const s6 = wb.addWorksheet("C6_NguoiHoc");
  styleHeader(s6, ["Nhóm", "Nội dung", "Mô tả", "Năm học", "Chỉ số", "Đối tượng", "Đơn vị phụ trách", "Số người hưởng lợi"]);
  s6.addRow(["Học bổng", "Học bổng khuyến khích học tập", "", "2023-2024", 50, "Sinh viên SBI", "Phòng CTSV", 120]);
  const s7 = wb.addWorksheet("C7_CoSoVatChat");
  styleHeader(s7, ["Tên", "Loại", "Mã", "Số lượng", "Sức chứa", "Diện tích", "Tình trạng", "Tỷ lệ sử dụng", "Năm sử dụng", "Vị trí"]);
  s7.addRow(["Phòng máy A1", "Phòng máy", "PM-A1", 1, 40, 80, "Tốt", 85, 2020, "Tầng 3 nhà A"]);
  const s8 = wb.addWorksheet("C8_KetQua");
  styleHeader(s8, ["Tên chỉ số", "Nhóm", "Năm học", "Giá trị", "Đơn vị tính", "Mục tiêu", "Đối sánh", "Khóa", "Nguồn dữ liệu"]);
  s8.addRow(["Tỷ lệ tốt nghiệp đúng hạn", "Tốt nghiệp", "2028-2029", 88, "%", 90, 85, "K1", "Phòng Đào tạo"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
