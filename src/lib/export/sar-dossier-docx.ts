import {
  Document, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
} from "docx";
import { prisma } from "@/lib/prisma/client";
import { getSar } from "@/lib/sar/service";
import { sarStateLabel } from "@/lib/sar/state";
import { aggregateScores } from "@/lib/sar/internal-review";
import { ploCourseMatrix } from "@/lib/obe/matrix";
import { ploMatrix, PLO_DIMENSIONS, type PloDimension } from "@/lib/obe/plo-matrix";

const REQ_VI: Record<string, string> = { met: "Đạt", partial: "Đạt một phần", not_met: "Chưa đạt", na: "Không áp dụng", not_assessed: "Chưa đánh giá" };

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level });
}
function kv(label: string, value: string) {
  return new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: value || "—" })] });
}
function cell(text: string, bold = false) {
  return new TableCell({ margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
}
function table(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((x) => cell(x, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });
}

/** Xuất HỒ SƠ TỰ ĐÁNH GIÁ ĐẦY ĐỦ: phân tích tiêu chí + checklist yêu cầu + điểm hội đồng
 *  + phụ lục ma trận PLO + C5–C8 + khảo sát + danh mục minh chứng. */
export async function buildSarDossierDocx(sarId: string): Promise<Buffer> {
  const sar = await getSar(sarId);
  const versionId = sar.programmeVersionId;
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({ text: sar.title, heading: HeadingLevel.TITLE }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Trạng thái: ${sarStateLabel(sar.status)}`, italics: true })] }));

  // ─── 1) Phân tích theo tiêu chí + checklist yêu cầu + điểm hội đồng ─────────
  const agg = await aggregateScores(sarId);
  const aggByCrit = new Map(agg.map((a) => [a.criterionId, a]));
  const reqResponses = await prisma.sarRequirementResponse.findMany({ where: { sarId } });
  const reqRespByReq = new Map(reqResponses.map((r) => [r.requirementId, r]));

  children.push(h("PHẦN I. PHÂN TÍCH THEO TIÊU CHÍ", HeadingLevel.HEADING_1));
  for (const r of sar.responses) {
    const c = r.criterion;
    children.push(h(c ? `${c.code}. ${c.titleVi}` : "(Tiêu chí)", HeadingLevel.HEADING_2));
    for (const [label, value] of [
      ["Mô tả hiện trạng", r.currentState], ["Phân tích mức độ đáp ứng", r.analysis],
      ["Điểm mạnh", r.strengths], ["Điểm tồn tại", r.weaknesses],
      ["Cải tiến đã thực hiện", r.improvementDone], ["Kế hoạch cải tiến", r.improvementPlan],
    ] as [string, string | null | undefined][]) {
      children.push(kv(label, value || "—"));
    }
    const a = c ? aggByCrit.get(c.id) : undefined;
    children.push(kv("Điểm tự đánh giá", r.selfScore != null ? String(r.selfScore) : "—"));
    children.push(kv("Điểm hội đồng (TB/min–max)", a ? `${a.average.toFixed(1)} (${a.min}–${a.max}, ${a.reviewerCount} lượt)` : "—"));

    // Checklist yêu cầu con.
    if (c) {
      const reqs = await prisma.requirement.findMany({ where: { criterionId: c.id }, orderBy: { order: "asc" } });
      if (reqs.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: "Đánh giá theo yêu cầu:", bold: true })] }));
        children.push(table(["Mã", "Yêu cầu", "Mức đáp ứng", "Ghi chú"],
          reqs.map((q) => { const rr = reqRespByReq.get(q.id); return [q.code, q.title, REQ_VI[rr?.status ?? "not_assessed"], rr?.note ?? ""]; })));
      }
    }
  }

  // ─── 2) Phụ lục ma trận ────────────────────────────────────────────────────
  children.push(h("PHẦN II. PHỤ LỤC MA TRẬN", HeadingLevel.HEADING_1));
  const plos = await prisma.programmeLearningOutcome.findMany({ where: { programmeVersionId: versionId }, orderBy: { order: "asc" } });
  if (plos.length) {
    // PLO × Học phần (I/R/M)
    const m = await ploCourseMatrix(versionId);
    const courseCodes = [...new Set(m.flatMap((row) => row.courses.map((c) => c.code)))].sort();
    if (courseCodes.length) {
      children.push(h("Ma trận PLO × Học phần (I/R/M)", HeadingLevel.HEADING_2));
      children.push(table(["PLO", ...courseCodes],
        m.map((row) => [row.ploCode, ...courseCodes.map((cc) => row.courses.find((x) => x.code === cc)?.level ?? "")])));
    }
    // Các ma trận PLO khác.
    for (const dim of PLO_DIMENSIONS as readonly PloDimension[]) {
      const pm = await ploMatrix(versionId, dim);
      if (pm.columns.length === 0 || pm.cells.length === 0) continue;
      children.push(h(pm.label, HeadingLevel.HEADING_2));
      const ploById = new Map(pm.plos.map((p) => [p.id, p.code]));
      children.push(table(["PLO", ...pm.columns.map((c) => c.label)],
        pm.plos.map((p) => [ploById.get(p.id) ?? "", ...pm.columns.map((c) => pm.cells.find((x) => x.ploId === p.id && x.colKey === c.key)?.value ?? "")])));
    }
  }

  // ─── 3) Phụ lục dữ liệu C5–C8 ──────────────────────────────────────────────
  children.push(h("PHẦN III. DỮ LIỆU C5–C8", HeadingLevel.HEADING_1));
  const [staff, students, facilities, outcomes] = await Promise.all([
    prisma.academicStaff.findMany({ where: { deletedAt: null }, take: 200 }),
    prisma.studentService.findMany({ where: { deletedAt: null }, take: 200 }),
    prisma.facility.findMany({ where: { deletedAt: null }, take: 200 }),
    prisma.outcomeMetric.findMany({ where: { deletedAt: null }, take: 200 }),
  ]);
  children.push(h("C5. Đội ngũ giảng viên", HeadingLevel.HEADING_2));
  children.push(staff.length ? table(["Họ tên", "Học hàm/vị", "Chuyên môn", "FTE"], staff.map((s) => [s.fullName, `${s.academicRank ?? ""} ${s.degree ?? ""}`.trim(), s.specialization ?? "", s.fte != null ? String(s.fte) : ""])) : kv("", "(chưa có dữ liệu)"));
  children.push(h("C6. Người học & hỗ trợ", HeadingLevel.HEADING_2));
  children.push(students.length ? table(["Nhóm", "Nội dung", "Năm học", "Số người"], students.map((s) => [s.category, s.title, s.academicYear ?? "", s.beneficiaries != null ? String(s.beneficiaries) : ""])) : kv("", "(chưa có dữ liệu)"));
  children.push(h("C7. Cơ sở vật chất", HeadingLevel.HEADING_2));
  children.push(facilities.length ? table(["Tên", "Loại", "Số lượng", "Diện tích"], facilities.map((f) => [f.name, f.type, f.quantity != null ? String(f.quantity) : "", f.area != null ? String(f.area) : ""])) : kv("", "(chưa có dữ liệu)"));
  children.push(h("C8. Kết quả đầu ra", HeadingLevel.HEADING_2));
  children.push(outcomes.length ? table(["Chỉ số", "Nhóm", "Giá trị", "Mục tiêu"], outcomes.map((o) => [o.name, o.category, o.value != null ? `${o.value}${o.unit ?? ""}` : "", o.target != null ? String(o.target) : ""])) : kv("", "(chưa có dữ liệu)"));

  // ─── 4) Kết quả khảo sát các bên liên quan ─────────────────────────────────
  children.push(h("PHẦN IV. KHẢO SÁT CÁC BÊN LIÊN QUAN", HeadingLevel.HEADING_1));
  const surveys = await prisma.survey.findMany({ where: { deletedAt: null }, include: { _count: { select: { responses: true } } }, take: 50 });
  children.push(surveys.length
    ? table(["Khảo sát", "Trạng thái", "Số phản hồi"], surveys.map((s) => [s.title, s.status, String(s._count.responses)]))
    : kv("", "(chưa có khảo sát)"));

  // ─── 5) Danh mục minh chứng theo tiêu chí ──────────────────────────────────
  children.push(h("PHẦN V. DANH MỤC MINH CHỨNG", HeadingLevel.HEADING_1));
  const evidence = await prisma.evidence.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    include: { criteria: true },
  });
  const critCodeById = new Map(sar.responses.map((r) => [r.criterionId, r.criterion?.code ?? ""]));
  children.push(evidence.length
    ? table(["Mã", "Tên minh chứng", "Tiêu chí", "Trạng thái"],
        evidence.map((e) => [e.code, e.title, e.criteria.map((m) => critCodeById.get(m.criterionId) || "").filter(Boolean).join(", "), e.status]))
    : kv("", "(chưa có minh chứng)"));

  const doc = new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { size: 22 } } } },
  });
  void AlignmentType;
  return Buffer.from(await Packer.toBuffer(doc));
}
