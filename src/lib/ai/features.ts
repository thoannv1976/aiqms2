import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { notFound, badRequest } from "@/lib/http/responses";
import { getStorage } from "@/lib/storage";
import { getSar } from "@/lib/sar/service";
import { docxToText } from "@/lib/import/docx";
import { pdfToText } from "@/lib/import/syllabus";
import { matrixDraftSchema, type MatrixDraft } from "@/lib/obe/matrix";
import { coverageWarnings } from "@/lib/obe/coverage";
import {
  DIMENSION_LABELS,
  matrixCellsDraftSchema,
  ploMatrix,
  type MatrixCellsDraft,
  type PloDimension,
} from "@/lib/obe/plo-matrix";
import { aiComplete, aiCompleteJson } from "./service";

const SYSTEM_VI =
  "Bạn là trợ lý kiểm định AUN-QA. Chỉ dựa trên dữ liệu được cung cấp, KHÔNG bịa minh chứng. Viết tiếng Việt học thuật, ngắn gọn.";

/** Lưu một bản nháp do AI sinh — LUÔN đánh dấu nguồn=ai, trạng thái=draft. */
async function saveDraft(input: {
  module: string;
  content: string;
  targetType?: string;
  targetId?: string;
  field?: string;
}) {
  const ctx = requireTenantContext();
  const draft = await prisma.aiGeneratedDraft.create({
    data: withTenantId({ ...input, source: "ai", status: "draft", createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "ai.draft", entity: "AiGeneratedDraft", entityId: draft.id, meta: { module: input.module } });
  return draft;
}

/** AI tóm tắt minh chứng (tạo bản nháp, không ghi vào hồ sơ chính). */
export async function summarizeEvidence(evidenceId: string) {
  const ev = await prisma.evidence.findFirst({ where: { id: evidenceId }, include: { files: true } });
  if (!ev) throw notFound("Minh chứng không tồn tại");
  const fileList = ev.files.map((f) => f.fileName).join(", ") || "(chưa có file)";
  const text = await aiComplete("summarize_evidence", [
    { role: "system", content: SYSTEM_VI },
    {
      role: "user",
      content: `Tóm tắt minh chứng sau cho hồ sơ kiểm định:\nMã: ${ev.code}\nTên: ${ev.title}\nMô tả: ${ev.description ?? "—"}\nFile: ${fileList}`,
    },
  ]);
  return saveDraft({ module: "summarize_evidence", content: text, targetType: "Evidence", targetId: ev.id });
}

/** AI viết nháp phân tích cho một tiêu chí của SAR (human-in-the-loop). */
export async function draftSarCriterion(sarResponseId: string, field: "analysis" | "strengths" | "weaknesses" = "analysis") {
  const resp = await prisma.sarCriterionResponse.findFirst({ where: { id: sarResponseId } });
  if (!resp) throw notFound("Tiêu chí SAR không tồn tại");
  const criterion = await prisma.criterion.findUnique({ where: { id: resp.criterionId } });

  // Lấy minh chứng liên kết tiêu chí (chỉ dữ liệu được phép — đã lọc theo tenant).
  const evidences = await prisma.evidence.findMany({
    where: { criteria: { some: { criterionId: resp.criterionId } } },
    select: { code: true, title: true },
    take: 20,
  });
  const evText = evidences.map((e) => `${e.code}: ${e.title}`).join("\n") || "(chưa có minh chứng)";

  const text = await aiComplete("draft_sar", [
    { role: "system", content: SYSTEM_VI },
    {
      role: "user",
      content: `Viết nháp phần "${field}" cho tiêu chí ${criterion?.code ?? ""} - ${criterion?.titleVi ?? ""}.\nHiện trạng: ${resp.currentState ?? "—"}\nMinh chứng hiện có:\n${evText}`,
    },
  ]);

  return saveDraft({
    module: "draft_sar",
    content: text,
    targetType: "SarCriterionResponse",
    targetId: sarResponseId,
    field,
  });
}

/** Người phụ trách duyệt bản nháp -> ghi vào hồ sơ chính (human-in-the-loop). */
export async function approveDraft(draftId: string) {
  const ctx = requireTenantContext();
  const draft = await prisma.aiGeneratedDraft.findFirst({ where: { id: draftId } });
  if (!draft) throw notFound("Bản nháp không tồn tại");
  if (draft.status !== "draft") throw badRequest("Bản nháp đã được xử lý");

  // Chỉ khi duyệt, nội dung AI mới vào bản chính thức.
  if (draft.targetType === "SarCriterionResponse" && draft.targetId && draft.field) {
    await prisma.sarCriterionResponse.update({
      where: { id: draft.targetId },
      data: { [draft.field]: draft.content, updatedBy: ctx.actorId },
    });
  }
  const updated = await prisma.aiGeneratedDraft.update({
    where: { id: draftId },
    data: { status: "approved", approvedBy: ctx.actorId, approvedAt: new Date() },
  });
  await writeAudit({ action: "ai.draft.approve", entity: "AiGeneratedDraft", entityId: draftId });
  return updated;
}

export async function rejectDraft(draftId: string) {
  const ctx = requireTenantContext();
  const draft = await prisma.aiGeneratedDraft.findFirst({ where: { id: draftId } });
  if (!draft) throw notFound("Bản nháp không tồn tại");
  const updated = await prisma.aiGeneratedDraft.update({
    where: { id: draftId },
    data: { status: "rejected", approvedBy: ctx.actorId, approvedAt: new Date() },
  });
  await writeAudit({ action: "ai.draft.reject", entity: "AiGeneratedDraft", entityId: draftId });
  return updated;
}

/** AI kiểm tra khoảng trống SAR (đặc tả 5.3): tính trực tiếp + nhận xét AI. */
export async function gapCheck(sarId: string) {
  const sar = await getSar(sarId);
  const gaps: { criterion: string; issues: string[] }[] = [];

  for (const r of sar.responses) {
    const issues: string[] = [];
    const evidenceCount = await prisma.evidenceCriterionMapping.count({
      where: { criterionId: r.criterionId },
    });
    if (evidenceCount === 0) issues.push("Chưa có minh chứng liên kết");
    if (!r.analysis) issues.push("Chưa có phân tích mức độ đáp ứng");
    if (r.selfScore == null) issues.push("Chưa chấm điểm tự đánh giá");
    if (issues.length) {
      gaps.push({ criterion: r.criterion ? `${r.criterion.code}. ${r.criterion.titleVi}` : r.criterionId, issues });
    }
  }

  let aiComment: string | null = null;
  try {
    aiComment = await aiComplete("gap_check", [
      { role: "system", content: SYSTEM_VI },
      { role: "user", content: `Tổng hợp khoảng trống hồ sơ:\n${JSON.stringify(gaps, null, 2)}\nĐề xuất ưu tiên xử lý.` },
    ]);
  } catch {
    aiComment = null; // AI tắt vẫn trả phần tính toán
  }

  return { sarId, gapCount: gaps.length, gaps, aiComment };
}

/**
 * AI gợi ý hành động cải tiến (PDCA) + KPI cho một Kế hoạch cải tiến.
 * Human-in-the-loop: CHỈ trả về gợi ý (không tự ghi vào DB) — người phụ trách
 * xem rồi chọn "Thêm" từng mục mới đưa vào kế hoạch chính thức.
 */
const improvementSuggestionSchema = z.object({
  actions: z
    .array(
      z.object({
        action: z.string(),
        pdcaPhase: z.enum(["plan", "do", "check", "act"]).default("plan"),
        responsibleUnit: z.string().optional(),
      }),
    )
    .max(8),
  kpis: z
    .array(z.object({ name: z.string(), unit: z.string().optional(), target: z.number().optional() }))
    .max(6),
});
export type ImprovementSuggestion = z.infer<typeof improvementSuggestionSchema>;

export async function suggestImprovementActions(planId: string): Promise<ImprovementSuggestion> {
  const plan = await prisma.improvementPlan.findFirst({ where: { id: planId } });
  if (!plan) throw notFound("Kế hoạch cải tiến không tồn tại");
  const criterion = plan.criterionId
    ? await prisma.criterion.findUnique({ where: { id: plan.criterionId } })
    : null;

  const result = await aiCompleteJson(
    "suggest_improvement",
    [
      { role: "system", content: SYSTEM_VI },
      {
        role: "user",
        content:
          `Đề xuất kế hoạch cải tiến theo chu trình PDCA cho vấn đề kiểm định AUN-QA sau.\n` +
          `Tiêu chí: ${criterion ? `${criterion.code} - ${criterion.titleVi}` : "—"}\n` +
          `Kế hoạch: ${plan.title}\nVấn đề: ${plan.issue ?? "—"}\nNguyên nhân: ${plan.cause ?? "—"}\n\n` +
          `Trả về JSON thuần đúng cấu trúc: {"actions":[{"action","pdcaPhase":"plan|do|check|act","responsibleUnit"}],` +
          `"kpis":[{"name","unit","target"}]}. Tối đa 8 hành động, 6 KPI. Bằng tiếng Việt.`,
      },
    ],
    improvementSuggestionSchema,
  );
  await writeAudit({ action: "ai.suggest", entity: "ImprovementPlan", entityId: planId, meta: { module: "suggest_improvement" } });
  return result;
}

/** Trích text từ một Document đã lưu (docx/pdf/text), có cắt độ dài + lọc dòng. */
async function documentText(
  doc: { storageKey: string; fileName: string },
  maxChars: number,
  lineFilter?: (l: string) => boolean,
): Promise<string> {
  const bytes = await getStorage().get(doc.storageKey);
  if (!bytes) return "";
  let text = "";
  try {
    if (/\.pdf$/i.test(doc.fileName)) text = await pdfToText(bytes);
    else if (/\.docx$/i.test(doc.fileName)) text = await docxToText(bytes);
    else text = bytes.toString("utf8");
  } catch {
    return "";
  }
  if (lineFilter) text = text.split("\n").filter((l) => l.trim() && lineFilter(l)).join("\n");
  return text.slice(0, maxChars);
}

/**
 * AI TRÍCH XUẤT ma trận PLO × HỌC PHẦN (mức I/R/M) từ tài liệu Đề án mở ngành / CTĐT đã upload
 * (kèm CLO–PLO từ đề cương nếu có). Human-in-the-loop: chỉ TRẢ VỀ bản nháp để người dùng duyệt.
 */
export async function synthesizeMatrixFromDocs(
  programmeVersionId: string,
): Promise<MatrixDraft & { ploCount: number; courseCount: number; docCount: number }> {
  const plos = await prisma.programmeLearningOutcome.findMany({
    where: { programmeVersionId },
    orderBy: { order: "asc" },
  });
  if (plos.length === 0) {
    throw badRequest("Phiên bản CTĐT chưa có PLO — hãy import/khai báo PLO trước khi tổng hợp.");
  }
  // Ưu tiên học phần thuộc CTĐT này; nếu chưa gán thì lấy tất cả. Giới hạn để output JSON
  // không quá lớn (tránh bị cắt cụt theo token).
  const version = await prisma.programmeVersion.findFirst({ where: { id: programmeVersionId }, select: { programmeId: true } });
  const ofProgramme = version
    ? await prisma.course.findMany({ where: { deletedAt: null, programmeId: version.programmeId }, orderBy: { code: "asc" }, take: 80, include: { clos: { orderBy: { order: "asc" } } } })
    : [];
  const courses = ofProgramme.length
    ? ofProgramme
    : await prisma.course.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" }, take: 80, include: { clos: { orderBy: { order: "asc" } } } });
  if (courses.length === 0) throw badRequest("Chưa có học phần nào để tổng hợp ma trận.");

  const ploCodes = new Set(plos.map((p) => p.code.toUpperCase()));

  // Trọng tâm: TRÍCH XUẤT ma trận PLO × học phần TỪ tài liệu Đề án mở ngành / CTĐT đã upload.
  // Lấy vùng bảng ma trận (dòng có mã PLO, mã học phần, hoặc ô mức I/R/M, 1/2/3, I/T/U).
  const ctdtDocs = await prisma.document.findMany({ where: { category: "ctdt_source" }, orderBy: { createdAt: "desc" }, take: 2 });
  const sylDocs = await prisma.document.findMany({ where: { category: "syllabus" }, orderBy: { createdAt: "desc" }, take: 8 });

  const isMatrixLine = (l: string) =>
    /PLO\s*\d/i.test(l) ||
    /\b[A-Z]{2,4}\d{2,3}[A-Z]?\b/.test(l) || // mã học phần
    /(^|\t)\s*([IRMTU]|[123]|—|-)\s*(\t|$)/.test(l); // ô mức trong bảng

  let docContext = "";
  for (const d of ctdtDocs) {
    const t = await documentText(d, 9000, isMatrixLine);
    if (t) docContext += `\n[ĐỀ ÁN/CTĐT: ${d.title}]\n${t}\n`;
  }
  for (const d of sylDocs) {
    const t = await documentText(d, 800, (l) => /CLO|PLO|đóng góp/i.test(l));
    if (t) docContext += `\n[ĐỀ CƯƠNG: ${d.title}]\n${t}\n`;
  }
  docContext = docContext.slice(0, 18000);

  const ploList = plos.map((p) => `${p.code}: ${(p.description ?? "").slice(0, 120)}`).join("\n");
  const courseList = courses
    .map((c) => `${c.code} — ${c.name}${c.clos.length ? ` [CLO: ${c.clos.map((x) => x.code).join(",")}]` : ""}`)
    .join("\n");

  const draft = await aiCompleteJson(
    "synthesize_matrix",
    [
      {
        role: "system",
        content:
          "Bạn là chuyên gia kiểm định CTĐT theo OBE/AUN-QA. Nhiệm vụ: TRÍCH XUẤT ma trận đóng góp " +
          "của HỌC PHẦN vào CHUẨN ĐẦU RA CHƯƠNG TRÌNH (PLO) TỪ tài liệu Đề án mở ngành/CTĐT được cung cấp " +
          "(tìm bảng ma trận có các cột PLO1..PLOn và các dòng học phần; ô ghi mức I/R/M hoặc 1/2/3 hoặc I/T/U). " +
          "CHỈ dùng mã PLO và mã học phần trong danh sách cho sẵn; KHÔNG bịa. Nếu tài liệu không có ô tương ứng " +
          "thì bỏ trống (đừng đoán bừa). Trả về JSON thuần.",
      },
      {
        role: "user",
        content:
          "DANH SÁCH PLO (cột):\n" + ploList +
          "\n\nDANH SÁCH HỌC PHẦN (dòng):\n" + courseList +
          "\n\nTRÍCH TÀI LIỆU ĐỀ ÁN/CTĐT (chứa bảng ma trận PLO × học phần) + đề cương:\n" +
          (docContext || "(không có tài liệu — hãy suy luận hợp lý từ tên học phần & PLO)") +
          '\n\nTrả JSON: {"ploCourse":[{"courseCode","ploCode","level":"I|R|M"}],' +
          '"cloPlo":[{"courseCode","cloCode","ploCode"}]}. ' +
          "ploCourse là PHẦN CHÍNH — trích đúng theo bảng trong tài liệu (mức I=giới thiệu, R=củng cố, " +
          "M=thành thạo; quy đổi 1/2/3 hoặc I/T/U). cloPlo chỉ điền nếu đề cương có nêu. " +
          "QUAN TRỌNG: JSON THUẦN, KHÔNG xuống dòng/khoảng trắng thừa, KHÔNG kèm giải thích.",
      },
    ],
    matrixDraftSchema,
  );

  // Lọc bỏ mã PLO không thuộc phiên bản + item rỗng (.catch trả mã rỗng).
  const ploCourse = draft.ploCourse.filter((m) => m.ploCode && ploCodes.has(m.ploCode.trim().toUpperCase()));
  const cloPlo = draft.cloPlo.filter((m) => m.ploCode && ploCodes.has(m.ploCode.trim().toUpperCase()));
  await writeAudit({ action: "ai.synthesize_matrix", entity: "ProgrammeVersion", entityId: programmeVersionId, meta: { ploCourse: ploCourse.length, cloPlo: cloPlo.length } });
  return { ploCourse, cloPlo, ploCount: plos.length, courseCount: courses.length, docCount: ctdtDocs.length + sylDocs.length };
}

// ─── AI cho HỆ MA TRẬN PLO (đánh giá / nâng cấp-gợi ý) ───────────────────────
/** Tóm tắt hiện trạng các ma trận của một phiên bản CTĐT để đưa vào prompt. */
async function matrixSnapshot(programmeVersionId: string) {
  const [plos, courses, warnings] = await Promise.all([
    prisma.programmeLearningOutcome.findMany({ where: { programmeVersionId }, orderBy: { order: "asc" }, include: { courseMappings: true } }),
    prisma.course.findMany({ where: { deletedAt: null }, select: { code: true, name: true } }),
    coverageWarnings(programmeVersionId),
  ]);
  const cells = await prisma.ploMatrixCell.findMany({ where: { programmeVersionId } });
  const byDim = (d: string) => cells.filter((c) => c.dimension === d).length;
  return { plos, courses, warnings, dimCounts: { peo: byDim("peo"), teaching: byDim("teaching"), assessment: byDim("assessment"), measurement: byDim("measurement") } };
}

/** AI ĐÁNH GIÁ hệ ma trận PLO theo AUN-QA (constructive alignment, độ phủ, cân bằng I/R/M…). */
export async function evaluateMatrices(programmeVersionId: string): Promise<string> {
  const snap = await matrixSnapshot(programmeVersionId);
  if (snap.plos.length === 0) throw badRequest("Phiên bản CTĐT chưa có PLO để đánh giá.");
  const ploLines = snap.plos
    .map((p) => `${p.code}: ${p.courseMappings.length} học phần (mức ${[...new Set(p.courseMappings.map((m) => m.level))].sort().join("/") || "—"})`)
    .join("\n");
  const warnLines = snap.warnings.map((w) => `- [${w.severity}] ${w.message}`).join("\n") || "(không có cảnh báo tự động)";

  const review = await aiComplete("evaluate_matrix", [
    {
      role: "system",
      content:
        "Bạn là đánh giá viên AUN-QA. Đánh giá HỆ MA TRẬN PLO của chương trình theo các tiêu chí: " +
        "constructive alignment (PEO–PLO–học phần–CLO–đánh giá), độ phủ (mỗi PLO có học phần đóng góp), " +
        "tiến trình I→R→M (mỗi PLO cần có mức M cuối khóa, không chỉ I), cân bằng tải, đa dạng phương pháp " +
        "dạy học (C3) và đánh giá (C4), minh chứng đo lường (C8). Nhận xét NGẮN GỌN theo gạch đầu dòng: " +
        "điểm đạt, điểm yếu, và đề xuất cải thiện cụ thể cho từng ma trận.",
    },
    {
      role: "user",
      content:
        `PLO và độ phủ học phần:\n${ploLines}\n\n` +
        `Cảnh báo độ phủ tự động:\n${warnLines}\n\n` +
        `Số ô đã khai báo: PEO–PLO=${snap.dimCounts.peo}, PLO–PPdạy=${snap.dimCounts.teaching}, ` +
        `PLO–PPđánh giá=${snap.dimCounts.assessment}, PLO–Minh chứng=${snap.dimCounts.measurement}. ` +
        `Tổng học phần trong CTĐT: ${snap.courses.length}.`,
    },
  ]);
  await writeAudit({ action: "ai.evaluate_matrix", entity: "ProgrammeVersion", entityId: programmeVersionId });
  return review;
}

/**
 * AI NÂNG CẤP / GỢI Ý ô cho một ma trận PLO (peo|teaching|assessment|measurement) — dùng
 * DỮ LIỆU THẬT: PEO/PLO đã import + phương pháp dạy/đánh giá trong đề cương đã upload.
 * Human-in-the-loop: trả bản nháp các ô, người dùng duyệt rồi áp dụng.
 */
export async function suggestPloMatrix(
  programmeVersionId: string,
  dimension: PloDimension,
): Promise<MatrixCellsDraft & { dimension: PloDimension; label: string }> {
  const m = await ploMatrix(programmeVersionId, dimension);
  if (m.plos.length === 0) throw badRequest("Phiên bản CTĐT chưa có PLO.");
  if (dimension === "peo" && m.columns.length === 0) throw badRequest("Ma trận PEO–PLO cần có PEO trước.");

  const ploList = m.plos.map((p) => `${p.code}: ${(p.description ?? "").slice(0, 120)}`).join("\n");

  // Dữ liệu thật theo từng chiều.
  let realData = "";
  if (dimension === "teaching" || dimension === "assessment") {
    const courses = await prisma.course.findMany({
      where: { deletedAt: null },
      select: { code: true, name: true, teachingMethods: true, assessmentMethods: true },
      take: 60,
    });
    realData = courses
      .map((c) => `${c.code} ${c.name}: ${(dimension === "teaching" ? c.teachingMethods : c.assessmentMethods) ?? ""}`.slice(0, 200))
      .join("\n").slice(0, 8000);
  } else if (dimension === "peo") {
    const peos = await prisma.programmeObjective.findMany({ where: { programmeVersionId }, orderBy: { order: "asc" } });
    realData = peos.map((p) => `${p.code}: ${p.description.slice(0, 160)}`).join("\n");
  } else if (dimension === "job") {
    // Vị trí việc làm: lấy từ Đề án/CTĐT đã upload (đề án SBI có ma trận vị trí việc làm).
    const docs = await prisma.document.findMany({ where: { category: "ctdt_source" }, orderBy: { createdAt: "desc" }, take: 1 });
    for (const d of docs) realData += await documentText(d, 6000, (l) => /việc làm|vị trí|nghề|chuyên viên|nhân viên|quản (lý|trị)|chuyên gia|giám đốc/i.test(l));
  }

  // Cột: chiều cố định liệt kê sẵn; chiều động (job/pi) để AI tự đề xuất nhãn cột.
  const colInstruction = m.dynamicCols
    ? (dimension === "job"
        ? "colKey = TÊN VỊ TRÍ VIỆC LÀM cụ thể (vd 'Chuyên viên Marketing số', 'Quản trị sàn TMĐT') — tự đề xuất 5–10 vị trí phù hợp ngành."
        : "colKey = MÃ CHỈ BÁO (vd 'PI1.1','PI1.2') — mỗi PLO tách 2–3 chỉ báo (PI) đo lường được.")
    : "CHỈ dùng khóa cột trong danh sách: " + m.columns.map((c) => `${c.key} (${c.label})`).join(", ");

  const valueHint = m.textMode
    ? "value là VĂN BẢN ngắn (vd: PI = phát biểu chỉ báo; cải tiến = hành động; minh chứng = nguồn/chu kỳ/đơn vị)."
    : 'value = "x" cho ô có liên kết.';

  const draft = await aiCompleteJson(
    "suggest_plo_matrix",
    [
      {
        role: "system",
        content:
          `Bạn là chuyên gia thiết kế CTĐT theo AUN-QA. Lập ma trận "${m.label}". ` +
          "Dùng đúng mã PLO trong danh sách; ưu tiên dữ liệu thật; không bịa. Trả về JSON thuần.",
      },
      {
        role: "user",
        content:
          `PLO (hàng):\n${ploList}\n\nQUY TẮC CỘT: ${colInstruction}\n\n` +
          (realData ? `DỮ LIỆU THẬT:\n${realData.slice(0, 9000)}\n\n` : "") +
          `Trả JSON: {"cells":[{"ploCode","colKey","value"}]}. ${valueHint} ` +
          "Chỉ thêm ô thực sự phù hợp. JSON THUẦN, không xuống dòng/giải thích thừa.",
      },
    ],
    matrixCellsDraftSchema,
  );

  const ploCodes = new Set(m.plos.map((p) => p.code.toUpperCase()));
  const colKeys = new Set(m.columns.map((c) => c.key.toLowerCase()));
  const cells = draft.cells.filter((c) => {
    if (!c.ploCode || !ploCodes.has(c.ploCode.trim().toUpperCase())) return false;
    if (!(c.colKey ?? "").trim()) return false;
    // Chiều động: chấp nhận cột AI đề xuất; chiều cố định: chỉ cột hợp lệ.
    return m.dynamicCols || colKeys.has((c.colKey ?? "").trim().toLowerCase());
  });
  await writeAudit({ action: "ai.suggest_plo_matrix", entity: "ProgrammeVersion", entityId: programmeVersionId, meta: { dimension, cells: cells.length } });
  return { cells, dimension, label: DIMENSION_LABELS[dimension] };
}

// ─── AI lập KẾ HOẠCH đợt tự đánh giá (AUN-QA) ───────────────────────────────
const planTaskItem = z
  .object({
    title: z.string(),
    type: z.string().optional(),
    criterionCode: z.string().optional(),
    deliverables: z.string().optional(),
    role: z.string().optional(),
    priority: z.string().optional(),
    dueOffsetDays: z.coerce.number().int().optional(),
  })
  .catch({ title: "" }); // item lỗi -> bỏ (lọc title rỗng) thay vì hỏng cả kế hoạch
const cyclePlanAiSchema = z.object({ tasks: z.array(planTaskItem).default([]) });
export type CyclePlanAi = z.infer<typeof cyclePlanAiSchema>;

/** AI đề xuất kế hoạch công việc cho một đợt tự đánh giá AUN-QA (human-in-the-loop). */
export async function generateCyclePlan(cycleId: string): Promise<CyclePlanAi> {
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const criteria = await prisma.criterion.findMany({
    where: { standardVersionId: cycle.standardVersionId },
    orderBy: { order: "asc" },
    select: { code: true, titleVi: true },
  });
  const critList = criteria.map((c) => `${c.code}: ${c.titleVi}`).join("\n") || "(C1..C8 theo AUN-QA)";
  const programme = cycle.programmeId
    ? await prisma.programme.findFirst({ where: { id: cycle.programmeId }, select: { code: true, name: true } })
    : null;
  const progLine = programme ? `Chương trình được kiểm định: ${programme.code} — ${programme.name}.\n` : "";

  const result = await aiCompleteJson(
    "cycle_plan",
    [
      {
        role: "system",
        content:
          "Bạn là điều phối viên kiểm định AUN-QA. Lập KẾ HOẠCH CÔNG VIỆC cho một đợt tự đánh giá: " +
          "thành lập nhóm, thu thập minh chứng theo từng tiêu chí, viết SAR theo tiêu chí, rà soát cấp khoa/trường, " +
          "đánh giá nội bộ, hoàn thiện & xuất hồ sơ. Mỗi công việc nêu rõ MINH CHỨNG/sản phẩm phải nộp và vai trò phụ trách " +
          "(qa_office, programme_committee, faculty, lecturer, internal_reviewer). Trả về JSON thuần.",
      },
      {
        role: "user",
        content:
          `Đợt: ${cycle.name}${cycle.year ? ` (${cycle.year})` : ""}.\n${progLine}Các tiêu chí áp dụng:\n${critList}\n\n` +
          'Trả JSON: {"tasks":[{"title","type","criterionCode","deliverables","role","priority":"low|normal|high","dueOffsetDays"}]}. ' +
          "Mỗi tiêu chí có ít nhất 1 công việc thu thập minh chứng + 1 công việc viết SAR; thêm các công việc chung " +
          "(kế hoạch, rà soát, đánh giá nội bộ, xuất hồ sơ). dueOffsetDays = số ngày kể từ hôm nay. " +
          "JSON THUẦN, không xuống dòng/giải thích thừa.",
      },
    ],
    cyclePlanAiSchema,
  );
  const tasks = result.tasks.filter((t) => t.title?.trim());
  await writeAudit({ action: "ai.cycle_plan", entity: "AssessmentCycle", entityId: cycleId, meta: { tasks: tasks.length } });
  return { tasks };
}

// ─── Chỉnh sửa ĐỀ CƯƠNG học phần bằng AI (human-in-the-loop) ─────────────────
const COURSE_FIELD_LABELS: Record<string, string> = {
  description: "Mô tả học phần",
  content: "Nội dung & kế hoạch giảng dạy",
  teachingMethods: "Phương pháp giảng dạy",
  assessmentMethods: "Phương pháp & trọng số kiểm tra đánh giá",
  materials: "Học liệu (giáo trình, TLTK)",
  prerequisites: "Điều kiện tiên quyết",
};
export type CourseField = keyof typeof COURSE_FIELD_LABELS;

/** AI soạn/cải thiện MỘT mục của đề cương — trả về BẢN NHÁP (chưa lưu); người dùng duyệt rồi mới ghi. */
export async function draftCourseField(courseId: string, field: CourseField, instruction?: string): Promise<string> {
  const label = COURSE_FIELD_LABELS[field];
  if (!label) throw badRequest("Mục đề cương không hợp lệ");
  const course = await prisma.course.findFirst({ where: { id: courseId }, include: { clos: { orderBy: { order: "asc" } } } });
  if (!course) throw notFound("Học phần không tồn tại");

  const clos = course.clos.map((c) => `${c.code}: ${c.description}`).join("\n") || "(chưa khai báo CLO)";
  const current = ((course as unknown as Record<string, string | null>)[field] ?? "").toString();

  return aiComplete("draft_course", [
    {
      role: "system",
      content:
        SYSTEM_VI +
        " Bạn soạn đề cương chi tiết theo Mẫu 5A/5B của ĐHNT và chuẩn AUN-QA (tiêu chí 2,3,5: " +
        "constructive alignment giữa CLO – nội dung – phương pháp dạy – đánh giá). Viết tiếng Việt học thuật, súc tích.",
    },
    {
      role: "user",
      content:
        `Học phần: ${course.code} — ${course.name} (${course.credits} tín chỉ).\n` +
        `Chuẩn đầu ra học phần (CLO):\n${clos}\n\n` +
        `Mục cần ${current ? "CẢI THIỆN" : "SOẠN MỚI"}: "${label}".\n` +
        `Nội dung hiện tại:\n${current || "(trống)"}\n\n` +
        `Hãy viết lại mục "${label}" cho chuẩn, gắn với CLO, phù hợp số tín chỉ.` +
        (field === "assessmentMethods" ? " Nêu rõ cấu phần + trọng số (%) và CLO được đánh giá." : "") +
        (field === "materials" ? " Ưu tiên học liệu xuất bản trong 5 năm; ghi đúng định dạng trích dẫn." : "") +
        (instruction ? `\nYêu cầu thêm của người dùng: ${instruction}` : ""),
    },
  ]);
}

const fullSyllabusSchema = z.object({
  description: z.string().optional().default(""),
  prerequisites: z.string().optional().default(""),
  content: z.string().optional().default(""),
  teachingMethods: z.string().optional().default(""),
  assessmentMethods: z.string().optional().default(""),
  materials: z.string().optional().default(""),
});

/**
 * AI điền nhanh TOÀN BỘ đề cương trong MỘT lần gọi — sinh nháp cho các mục còn trống
 * (mặc định) hoặc tất cả. Trả về map field→text (chưa lưu); người dùng duyệt rồi mới ghi.
 */
export async function draftFullSyllabus(courseId: string, onlyEmpty = true): Promise<Record<string, string>> {
  const course = await prisma.course.findFirst({ where: { id: courseId }, include: { clos: { orderBy: { order: "asc" } } } });
  if (!course) throw notFound("Học phần không tồn tại");
  const keys: CourseField[] = ["description", "prerequisites", "content", "teachingMethods", "assessmentMethods", "materials"];
  const rec = course as unknown as Record<string, string | null>;
  const target = onlyEmpty ? keys.filter((k) => !(rec[k] ?? "").toString().trim()) : keys;
  if (target.length === 0) return {}; // không có mục trống -> không gọi AI

  const clos = course.clos.map((c) => `${c.code}: ${c.description}`).join("\n") || "(chưa khai báo CLO)";
  const wanted = target.map((k) => `"${k}" (${COURSE_FIELD_LABELS[k]})`).join(", ");
  const result = await aiCompleteJson(
    "draft_course_all",
    [
      {
        role: "system",
        content:
          SYSTEM_VI +
          " Soạn đề cương chi tiết theo Mẫu 5A/5B của ĐHNT và AUN-QA (TC2,3,5: constructive alignment " +
          "CLO – nội dung – phương pháp dạy – đánh giá). Trả về JSON thuần.",
      },
      {
        role: "user",
        content:
          `Học phần: ${course.code} — ${course.name} (${course.credits} tín chỉ).\n` +
          `CLO:\n${clos}\n\nSoạn nội dung cho CÁC MỤC: ${wanted}.\n` +
          `Trả JSON với đúng các khóa đó (giá trị là chuỗi tiếng Việt). ` +
          `assessmentMethods nêu cấu phần + trọng số (%) và CLO; materials ưu tiên học liệu 5 năm gần nhất.`,
      },
    ],
    fullSyllabusSchema,
  );

  const out: Record<string, string> = {};
  for (const k of target) {
    const v = (result as Record<string, string>)[k];
    if (v && v.trim()) out[k] = v;
  }
  await writeAudit({ action: "ai.draft_course_all", entity: "Course", entityId: courseId, meta: { fields: Object.keys(out).length } });
  return out;
}

/**
 * AI TẠO BẢN ĐỀ CƯƠNG ĐẠT CHUẨN AUN-QA — viết lại TOÀN BỘ dựa trên nội dung hiện có
 * (bản đã upload/đánh giá), khắc phục các điểm chưa đạt. Trả về bản nháp đầy đủ để duyệt.
 */
export async function generateCompliantSyllabus(courseId: string): Promise<Record<string, string>> {
  const course = await prisma.course.findFirst({ where: { id: courseId }, include: { clos: { orderBy: { order: "asc" } } } });
  if (!course) throw notFound("Học phần không tồn tại");
  const rec = course as unknown as Record<string, string | null>;
  const clos = course.clos.map((c) => `${c.code}: ${c.description}`).join("\n") || "(chưa có CLO)";
  const current =
    `Mô tả: ${rec.description ?? "—"}\nTiên quyết: ${rec.prerequisites ?? "—"}\n` +
    `Nội dung: ${(rec.content ?? "—").slice(0, 1500)}\nPP giảng dạy: ${rec.teachingMethods ?? "—"}\n` +
    `Đánh giá: ${rec.assessmentMethods ?? "—"}\nHọc liệu: ${rec.materials ?? "—"}\nCLO:\n${clos}`;

  const result = await aiCompleteJson(
    "compliant_syllabus",
    [
      {
        role: "system",
        content:
          SYSTEM_VI +
          " Viết lại TOÀN BỘ đề cương để ĐÁP ỨNG Mẫu 5A/5B của ĐHNT và AUN-QA 4.0 (TC2,3,5): CLO đo được " +
          "theo Bloom & phủ 3 trụ cột (kiến thức–kỹ năng–tự chủ), constructive alignment CLO–nội dung–PP dạy–đánh giá, " +
          "học liệu xuất bản trong 5 năm, trọng số đánh giá phủ hết CLO, đa dạng phương pháp. Giữ đúng bản chất học phần " +
          "(không bịa lĩnh vực khác). Trả về JSON thuần.",
      },
      {
        role: "user",
        content:
          `Học phần: ${course.code} — ${course.name} (${course.credits} tín chỉ).\n\n` +
          `NỘI DUNG HIỆN CÓ (cần nâng cấp cho đạt chuẩn):\n${current}\n\n` +
          'Trả JSON đầy đủ 6 mục: {"description","prerequisites","content","teachingMethods","assessmentMethods","materials"}. ' +
          "assessmentMethods nêu cấu phần + trọng số (%) và CLO; materials ưu tiên học liệu 5 năm gần nhất. " +
          "JSON THUẦN, không xuống dòng/giải thích thừa.",
      },
    ],
    fullSyllabusSchema,
  );
  const keys = ["description", "prerequisites", "content", "teachingMethods", "assessmentMethods", "materials"] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = (result as Record<string, string>)[k];
    if (v && v.trim()) out[k] = v;
  }
  await writeAudit({ action: "ai.compliant_syllabus", entity: "Course", entityId: courseId, meta: { fields: Object.keys(out).length } });
  return out;
}

/** AI rà soát toàn bộ đề cương theo Mẫu 5A/5B + AUN-QA, trả về nhận xét + điểm cần sửa. */
export async function reviewCourseSyllabus(courseId: string): Promise<string> {
  const course = await prisma.course.findFirst({ where: { id: courseId }, include: { clos: { orderBy: { order: "asc" } } } });
  if (!course) throw notFound("Học phần không tồn tại");
  const clos = course.clos.map((c) => `${c.code}: ${c.description}`).join("\n") || "(chưa có CLO)";
  const f = (k: string) => ((course as unknown as Record<string, string | null>)[k] ?? "(trống)");

  const review = await aiComplete("review_syllabus", [
    {
      role: "system",
      content:
        "Bạn là chuyên gia rà soát đề cương học phần theo Mẫu 5A/5B của ĐHNT và AUN-QA 4.0 " +
        "(tiêu chí 2,3,5). Nhận xét NGẮN GỌN theo gạch đầu dòng: nêu điểm đạt, điểm chưa đạt và " +
        "đề xuất sửa cụ thể. Chú ý: số tín chỉ hợp lý, CLO đo được theo Bloom, ma trận CLO–PLO, " +
        "học liệu trong 5 năm, constructive alignment, trọng số đánh giá phủ hết CLO.",
    },
    {
      role: "user",
      content:
        `Học phần: ${course.code} — ${course.name} (${course.credits} tín chỉ)\n` +
        `Tiên quyết: ${f("prerequisites")}\nMô tả: ${f("description")}\n` +
        `CLO:\n${clos}\nNội dung: ${f("content")}\nPhương pháp giảng dạy: ${f("teachingMethods")}\n` +
        `Đánh giá: ${f("assessmentMethods")}\nHọc liệu: ${f("materials")}`,
    },
  ]);
  await writeAudit({ action: "ai.review_syllabus", entity: "Course", entityId: courseId });
  return review;
}

/** AI trợ lý hướng dẫn theo màn hình: trả lời câu hỏi của người dùng dựa trên
 *  ngữ cảnh màn hình đang xem (không bịa tính năng ngoài phần mềm). */
export async function assistantAnswer(screen: string, question: string): Promise<string> {
  const { resolveGuide } = await import("@/lib/help/screens");
  const g = resolveGuide(screen);
  const ctx = g
    ? `Màn hình: ${g.title}\nMục đích: ${g.purpose}\nCác thao tác chính:\n- ${g.steps.join("\n- ")}${g.role ? `\nVai trò thường dùng: ${g.role}` : ""}`
    : `Màn hình: ${screen}`;
  return aiComplete("assistant", [
    {
      role: "system",
      content:
        "Bạn là trợ lý hướng dẫn sử dụng phần mềm kiểm định CTĐT AIQMS. Trả lời NGẮN GỌN, " +
        "bằng tiếng Việt, theo các bước thao tác cụ thể trên phần mềm. Chỉ dựa vào ngữ cảnh màn hình " +
        "được cung cấp; nếu câu hỏi ngoài phạm vi màn hình, chỉ dẫn người dùng tới menu phù hợp. " +
        "Không bịa tính năng không có.",
    },
    { role: "user", content: `${ctx}\n\nCâu hỏi của người dùng: ${question}` },
  ]);
}

/** AI gợi ý các HÀNH ĐỘNG TIẾP THEO phù hợp cho màn hình hiện tại (chủ động, không cần câu hỏi). */
export async function suggestScreenActions(screen: string): Promise<string> {
  const { resolveGuide } = await import("@/lib/help/screens");
  const g = resolveGuide(screen);
  const ctx = g
    ? `Màn hình: ${g.title}\nMục đích: ${g.purpose}\nCác thao tác chính:\n- ${g.steps.join("\n- ")}${g.role ? `\nVai trò thường dùng: ${g.role}` : ""}`
    : `Màn hình: ${screen}`;
  return aiComplete("screen_actions", [
    {
      role: "system",
      content:
        "Bạn là trợ lý AIQMS (kiểm định CTĐT theo AUN-QA). Dựa trên màn hình người dùng đang xem, " +
        "ĐỀ XUẤT 3–6 HÀNH ĐỘNG TIẾP THEO cụ thể, đúng thứ tự ưu tiên, mỗi hành động 1 dòng gạch đầu dòng, " +
        "tiếng Việt, ngắn gọn, bám đúng thao tác có trên phần mềm (không bịa tính năng). " +
        "Nếu hợp lý, gợi ý dùng các nút AI sẵn có trên màn hình đó.",
    },
    { role: "user", content: `${ctx}\n\nHãy đề xuất các việc nên làm tiếp theo tại màn hình này.` },
  ]);
}
