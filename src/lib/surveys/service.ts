import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { softDeleteData } from "@/lib/prisma/soft-delete";
import { badRequest, notFound } from "@/lib/http/responses";
import { paginated, type PageParams } from "@/lib/http/pagination";

export const createSurveySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  criterionId: z.string().optional(),
  groupId: z.string().optional(),
});

export async function createSurvey(input: z.infer<typeof createSurveySchema>) {
  const ctx = requireTenantContext();
  const survey = await prisma.survey.create({ data: withTenantId({ ...input, createdBy: ctx.actorId }) });
  await writeAudit({ action: "survey.create", entity: "Survey", entityId: survey.id });
  return survey;
}

export async function listSurveys(p: PageParams) {
  const [items, total] = await Promise.all([
    prisma.survey.findMany({
      orderBy: { createdAt: "desc" },
      skip: p.skip,
      take: p.take,
      include: { _count: { select: { questions: true, responses: true } } },
    }),
    prisma.survey.count(),
  ]);
  return paginated(items, total, p);
}

export async function getSurvey(id: string) {
  const survey = await prisma.survey.findFirst({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } }, _count: { select: { responses: true } } },
  });
  if (!survey) throw notFound("Khảo sát không tồn tại");
  return survey;
}

export const questionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(["rating", "text", "choice"]).default("rating"),
  order: z.number().int().positive().default(1),
  options: z.array(z.string()).optional(),
});

export async function addQuestion(surveyId: string, input: z.infer<typeof questionSchema>) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId } });
  if (!survey) throw notFound("Khảo sát không tồn tại");
  if (survey.status !== "draft") throw badRequest("Chỉ thêm câu hỏi khi khảo sát ở trạng thái nháp");
  return prisma.surveyQuestion.create({
    data: withTenantId({ surveyId, text: input.text, type: input.type, order: input.order, options: input.options }),
  });
}

/** Mở khảo sát: tạo token link công khai. */
export async function openSurvey(surveyId: string) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId } });
  if (!survey) throw notFound("Khảo sát không tồn tại");
  const token = survey.token ?? randomBytes(16).toString("hex");
  const updated = await prisma.survey.update({ where: { id: surveyId }, data: { status: "open", token } });
  await writeAudit({ action: "survey.open", entity: "Survey", entityId: surveyId });
  return updated;
}

export async function closeSurvey(surveyId: string) {
  const survey = await prisma.survey.findFirst({ where: { id: surveyId } });
  if (!survey) throw notFound("Khảo sát không tồn tại");
  return prisma.survey.update({ where: { id: surveyId }, data: { status: "closed" } });
}

/** Lấy khảo sát theo token (form công khai) — chỉ khi đang mở. */
export async function getByToken(token: string) {
  const survey = await prisma.survey.findFirst({
    where: { token, status: "open" },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!survey) throw notFound("Khảo sát không khả dụng");
  return survey;
}

/** Nộp phản hồi qua token (người trả lời ngoài — ẩn danh được). */
export async function submitByToken(token: string, answers: Record<string, unknown>, respondent?: unknown) {
  const survey = await getByToken(token);
  return prisma.surveyResponse.create({
    data: withTenantId({
      surveyId: survey.id,
      answers: answers as Prisma.InputJsonValue,
      respondent: (respondent ?? undefined) as Prisma.InputJsonValue | undefined,
    }),
  });
}

/** Phân tích kết quả: số phản hồi + điểm trung bình cho câu hỏi rating. */
export async function surveyResults(surveyId: string) {
  const survey = await getSurvey(surveyId);
  const responses = await prisma.surveyResponse.findMany({ where: { surveyId } });

  const perQuestion = survey.questions.map((q) => {
    if (q.type === "rating") {
      const vals = responses
        .map((r) => Number((r.answers as Record<string, unknown>)[q.id]))
        .filter((v) => !Number.isNaN(v));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { questionId: q.id, text: q.text, type: q.type, count: vals.length, average: avg };
    }
    const answered = responses.filter((r) => (r.answers as Record<string, unknown>)[q.id] != null).length;
    return { questionId: q.id, text: q.text, type: q.type, count: answered, average: null };
  });

  return { surveyId, totalResponses: responses.length, perQuestion };
}

/**
 * Đưa kết quả khảo sát vào dữ liệu C8 (Output & Outcomes) — C4.
 * Tổng hợp điểm trung bình các câu hỏi rating thành một chỉ số "mức hài lòng" của nhóm
 * bên liên quan, tạo `OutcomeMetric` (category=satisfaction) để dùng cho tiêu chí 8 và
 * ma trận PLO–Bên liên quan. Idempotent theo nguồn (dataSource = survey:<id>).
 */
export async function promoteSurveyToOutcome(surveyId: string) {
  const ctx = requireTenantContext();
  const survey = await prisma.survey.findFirst({ where: { id: surveyId }, include: { group: true } });
  if (!survey) throw notFound("Khảo sát không tồn tại");
  const results = await surveyResults(surveyId);
  const ratings = results.perQuestion.filter((q) => q.type === "rating" && q.average != null);
  if (ratings.length === 0) throw badRequest("Khảo sát chưa có câu hỏi rating có dữ liệu để tổng hợp");
  const avg = ratings.reduce((a, q) => a + (q.average ?? 0), 0) / ratings.length;

  const dataSource = `survey:${surveyId}`;
  const groupLabel = survey.group?.name ? ` (${survey.group.name})` : "";
  const data = {
    name: `Mức hài lòng${groupLabel} — ${survey.title}`,
    category: "satisfaction",
    value: Math.round(avg * 100) / 100,
    unit: "điểm",
    dataSource,
    note: `Tổng hợp từ ${results.totalResponses} phản hồi, ${ratings.length} câu hỏi rating`,
  };
  // Idempotent: cập nhật nếu đã đẩy từ khảo sát này.
  const existing = await prisma.outcomeMetric.findFirst({ where: { dataSource, deletedAt: null } });
  const row = existing
    ? await prisma.outcomeMetric.update({ where: { id: existing.id }, data: { ...data, updatedBy: ctx.actorId } })
    : await prisma.outcomeMetric.create({ data: withTenantId({ ...data, createdBy: ctx.actorId }) });
  await writeAudit({ action: existing ? "survey.to_outcome.update" : "survey.to_outcome.create", entity: "OutcomeMetric", entityId: row.id, meta: { surveyId } });
  return row;
}

export async function deleteSurvey(id: string) {
  const ctx = requireTenantContext();
  const survey = await prisma.survey.findFirst({ where: { id } });
  if (!survey) throw notFound("Khảo sát không tồn tại");
  await prisma.survey.update({ where: { id }, data: softDeleteData(ctx.actorId) });
  await writeAudit({ action: "survey.delete", entity: "Survey", entityId: id });
}
