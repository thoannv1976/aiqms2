import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import {
  addQuestion,
  createSurvey,
  getByToken,
  openSurvey,
  submitByToken,
  surveyResults,
} from "@/lib/surveys/service";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("P9 — Khảo sát bên liên quan", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("vòng đời: tạo → thêm câu hỏi → mở (token) → nộp → phân tích", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const survey = await createSurvey({ title: "Khảo sát cựu SV", criterionId: "c1" });
      const q1 = await addQuestion(survey.id, { text: "Mức hài lòng?", type: "rating", order: 1 });
      const q2 = await addQuestion(survey.id, { text: "Góp ý", type: "text", order: 2 });

      const opened = await openSurvey(survey.id);
      expect(opened.status).toBe("open");
      expect(opened.token).toBeTruthy();

      // Người ngoài lấy form theo token + nộp (ẩn danh).
      const form = await getByToken(opened.token!);
      expect(form.questions).toHaveLength(2);
      await submitByToken(opened.token!, { [q1.id]: 5, [q2.id]: "Tốt" });
      await submitByToken(opened.token!, { [q1.id]: 3, [q2.id]: "Cần cải thiện" });

      const results = await surveyResults(survey.id);
      expect(results.totalResponses).toBe(2);
      const ratingResult = results.perQuestion.find((p) => p.questionId === q1.id)!;
      expect(ratingResult.average).toBe(4); // (5+3)/2
    });
  });

  it("không thêm câu hỏi khi khảo sát đã mở", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const survey = await createSurvey({ title: "X" });
      await openSurvey(survey.id);
      await expect(addQuestion(survey.id, { text: "Q", type: "rating", order: 1 })).rejects.toThrow();
    });
  });

  it("cách ly tenant: khảo sát trường A không lọt sang B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await asTenant(a.id, () => createSurvey({ title: "A-survey" }));
    const inB = await asTenant(b.id, () => prisma.survey.findMany());
    expect(inB).toHaveLength(0);
  });
});
