import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { notFound, badRequest } from "@/lib/http/responses";
import { getSar } from "@/lib/sar/service";
import { aiComplete } from "./service";

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
