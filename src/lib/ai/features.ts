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
 * AI TỔNG HỢP ma trận PLO-CLO từ tài liệu đã upload (đề án mở ngành/CTĐT + đề cương học phần).
 * Human-in-the-loop: chỉ TRẢ VỀ bản nháp (chưa ghi) để người dùng duyệt rồi mới áp dụng.
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
  const courses = await prisma.course.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    take: 100,
    include: { clos: { orderBy: { order: "asc" } } },
  });
  if (courses.length === 0) throw badRequest("Chưa có học phần nào để tổng hợp ma trận.");

  const ploCodes = new Set(plos.map((p) => p.code.toUpperCase()));

  // Ngữ cảnh từ tài liệu: đề án/CTĐT (lấy vùng có nhắc PLO) + đề cương (lấy phần ma trận CLO–PLO).
  const ctdtDocs = await prisma.document.findMany({ where: { category: "ctdt_source" }, orderBy: { createdAt: "desc" }, take: 1 });
  const sylDocs = await prisma.document.findMany({ where: { category: "syllabus" }, orderBy: { createdAt: "desc" }, take: 12 });

  let docContext = "";
  for (const d of ctdtDocs) {
    const t = await documentText(d, 6000, (l) => /PLO\s*\d/i.test(l) || /\b[A-Z]{2,4}\d{2,3}[A-Z]?\b/.test(l));
    if (t) docContext += `\n[ĐỀ ÁN/CTĐT: ${d.title}]\n${t}\n`;
  }
  for (const d of sylDocs) {
    const t = await documentText(d, 1200, (l) => /CLO|PLO|tín chỉ|đóng góp/i.test(l));
    if (t) docContext += `\n[ĐỀ CƯƠNG: ${d.title}]\n${t}\n`;
  }
  docContext = docContext.slice(0, 16000);

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
          "Bạn là chuyên gia thiết kế chương trình đào tạo theo OBE/AUN-QA. Tổng hợp ma trận " +
          "đóng góp của học phần vào chuẩn đầu ra (PLO). CHỈ dùng mã PLO và mã học phần trong danh sách " +
          "được cung cấp; ưu tiên dữ liệu trong tài liệu; không bịa mã không có. Trả về JSON thuần.",
      },
      {
        role: "user",
        content:
          "DANH SÁCH PLO:\n" + ploList +
          "\n\nDANH SÁCH HỌC PHẦN:\n" + courseList +
          "\n\nTRÍCH TÀI LIỆU (đề án/CTĐT + đề cương):\n" + (docContext || "(không có tài liệu — hãy suy luận hợp lý từ tên học phần)") +
          '\n\nTrả JSON: {"ploCourse":[{"courseCode","ploCode","level":"I|R|M"}],' +
          '"cloPlo":[{"courseCode","cloCode","ploCode"}]}. ' +
          "Mức I=giới thiệu, R=củng cố, M=thành thạo (chấp nhận 1/2/3 hoặc I/T/U, sẽ tự quy đổi). " +
          "Mỗi học phần đóng góp vào 1–4 PLO phù hợp nhất; không để học phần nào trống nếu suy luận được.",
      },
    ],
    matrixDraftSchema,
  );

  // Lọc bỏ mã PLO không thuộc phiên bản (AI lỡ bịa).
  const ploCourse = draft.ploCourse.filter((m) => ploCodes.has(m.ploCode.trim().toUpperCase()));
  const cloPlo = draft.cloPlo.filter((m) => ploCodes.has(m.ploCode.trim().toUpperCase()));
  await writeAudit({ action: "ai.synthesize_matrix", entity: "ProgrammeVersion", entityId: programmeVersionId, meta: { ploCourse: ploCourse.length, cloPlo: cloPlo.length } });
  return { ploCourse, cloPlo, ploCount: plos.length, courseCount: courses.length, docCount: ctdtDocs.length + sylDocs.length };
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
