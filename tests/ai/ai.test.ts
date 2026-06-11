import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { encryptSecret, decryptSecret } from "@/lib/ai/crypto";
import { getSettings, updateSettings } from "@/lib/ai/settings";
import { listProviderModels } from "@/lib/ai/service";
import {
  approveDraft,
  draftSarCriterion,
  gapCheck,
  summarizeEvidence,
  assistantAnswer,
  suggestImprovementActions,
  draftCourseField,
  draftFullSyllabus,
  reviewCourseSyllabus,
} from "@/lib/ai/features";
import { createPlan } from "@/lib/improvement/service";
import { createEvidence } from "@/lib/evidence/service";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle, createSar, getSar } from "@/lib/sar/service";

let aunVersionId: string;
const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("P8 — Lớp AI (service có kiểm soát, human-in-the-loop)", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("mã hóa khóa API: roundtrip + có prefix phiên bản", () => {
    const enc = encryptSecret("sk-secret-123");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("sk-secret-123");
    expect(decryptSecret(enc)).toBe("sk-secret-123");
  });

  it("settings lưu khóa đã mã hóa, KHÔNG trả khóa ra ngoài", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, apiKey: "sk-abc", model: "gpt-4o-mini" });
      const s = await getSettings();
      expect(s.enabled).toBe(true);
      expect(s.hasApiKey).toBe(true);
      expect(JSON.stringify(s)).not.toContain("sk-abc");
      const row = await prisma.aiSettings.findFirstOrThrow({ where: { tenantId: t.id } });
      expect(row.apiKeyEnc?.startsWith("v1:")).toBe(true);
    });
  });

  it("AI tắt tường minh -> tính năng bị chặn (403)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: false }); // trường chủ động TẮT AI
      const ev = await createEvidence({ title: "MC", criterionIds: [], requirementIds: [] });
      await expect(summarizeEvidence(ev.id)).rejects.toMatchObject({ status: 403 });
    });
  });

  it("AI bật (mock): tóm tắt minh chứng -> bản nháp source=ai, status=draft", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true }); // không khóa -> mock provider
      const ev = await createEvidence({ title: "Đề cương CS101", criterionIds: [], requirementIds: [] });
      const draft = await summarizeEvidence(ev.id);
      expect(draft.source).toBe("ai");
      expect(draft.status).toBe("draft");
      expect(draft.content).toContain("[AI-nháp]");
      // Có ghi log token (đo chi phí).
      const reqs = await prisma.aiRequest.findMany({ where: { module: "summarize_evidence" } });
      expect(reqs.length).toBe(1);
      expect(reqs[0].tokensOut).toBeGreaterThan(0);
    });
  });

  it("human-in-the-loop: nháp KHÔNG vào SAR cho tới khi duyệt", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId });
      const sar = await createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR" });
      const detail = await getSar(sar.id);
      const respId = detail.responses[0].id;

      const draft = await draftSarCriterion(respId, "analysis");
      // Trước khi duyệt: response.analysis vẫn rỗng.
      const before = await prisma.sarCriterionResponse.findFirstOrThrow({ where: { id: respId } });
      expect(before.analysis).toBeNull();

      // Sau khi duyệt: nội dung AI mới vào hồ sơ chính.
      await approveDraft(draft.id);
      const after = await prisma.sarCriterionResponse.findFirstOrThrow({ where: { id: respId } });
      expect(after.analysis).toBe(draft.content);
      const approved = await prisma.aiGeneratedDraft.findFirstOrThrow({ where: { id: draft.id } });
      expect(approved.status).toBe("approved");
    });
  });

  it("hạn mức token/ngày: vượt -> chặn", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, dailyTokenLimit: 1 });
      const ev = await createEvidence({ title: "MC", criterionIds: [], requirementIds: [] });
      // Lần 1 chạy được và ghi token (đẩy usage vượt 1).
      await summarizeEvidence(ev.id);
      // Lần 2 bị chặn do vượt hạn mức.
      await expect(summarizeEvidence(ev.id)).rejects.toMatchObject({ code: "ai_quota_exceeded" });
    });
  });

  it("gap-check vẫn tính được khoảng trống dù AI tắt", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: false }); // trường TẮT AI tường minh
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId });
      const sar = await createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR" });
      const result = await gapCheck(sar.id); // AI tắt -> aiComment null, gaps vẫn có
      expect(result.gapCount).toBe(8); // 8 tiêu chí đều thiếu minh chứng/phân tích/điểm
      expect(result.aiComment).toBeNull();
      expect(result.gaps[0].issues).toContain("Chưa có minh chứng liên kết");
    });
  });

  it("trợ lý hướng dẫn theo màn hình trả lời bám ngữ cảnh", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const ans = await assistantAnswer("/sars/abc", "Làm sao nhập điểm tự đánh giá?");
      expect(ans).toContain("Báo cáo tự đánh giá"); // ngữ cảnh màn hình SAR được đưa vào
    });
  });

  it("AI gợi ý cải tiến PDCA: trả structured đúng schema, KHÔNG tự ghi vào kế hoạch", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const plan = await createPlan({ title: "Cải tiến C1", issue: "Thiếu rà soát PLO", cause: "Chưa có quy trình" });
      const sugg = await suggestImprovementActions(plan.id);
      expect(Array.isArray(sugg.actions)).toBe(true);
      expect(sugg.actions.length).toBeGreaterThan(0);
      expect(["plan", "do", "check", "act"]).toContain(sugg.actions[0].pdcaPhase);
      // Human-in-the-loop: gợi ý không tự tạo action trong DB.
      const count = await prisma.improvementAction.count({ where: { planId: plan.id } });
      expect(count).toBe(0);
    });
  });

  it("AI tắt -> gợi ý cải tiến bị chặn (403)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: false });
      const plan = await createPlan({ title: "KH" });
      await expect(suggestImprovementActions(plan.id)).rejects.toMatchObject({ status: 403 });
    });
  });

  it("LLM gọi lỗi (sai key/baseUrl) -> 502 kèm hướng xử lý, không 500 mù", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      // baseUrl trỏ vào cổng đóng -> fetch fail, mô phỏng sai cấu hình AI ở prod.
      await updateSettings({ enabled: true, apiKey: "sk-sai", baseUrl: "http://127.0.0.1:9/v1" });
      const ev = await createEvidence({ title: "MC", criterionIds: [], requirementIds: [] });
      await expect(summarizeEvidence(ev.id)).rejects.toMatchObject({
        status: 502,
        code: "ai_upstream_error",
      });
      // Lỗi vẫn được ghi log để theo dõi.
      const reqs = await prisma.aiRequest.findMany({ where: { status: "error" } });
      expect(reqs.length).toBeGreaterThan(0);
    });
  });

  it("API key không giải mã được (đổi ENCRYPTION_KEY) -> báo nhập lại key, không 500 mù", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, apiKey: "sk-ok" });
      // Giả lập key đã lưu bằng ENCRYPTION_KEY cũ: ghi đè chuỗi mã hóa rác.
      await prisma.aiSettings.updateMany({ data: { apiKeyEnc: "v1:aaaa:bbbb:cccc" } });
      const ev = await createEvidence({ title: "MC", criterionIds: [], requirementIds: [] });
      await expect(summarizeEvidence(ev.id)).rejects.toMatchObject({
        status: 400,
        code: "ai_key_decrypt_failed",
      });
    });
  });

  it("key Anthropic (sk-ant-) -> gọi đúng endpoint Claude (không gửi tới OpenAI)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, apiKey: "sk-ant-test-key" });
      const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
      const orig = global.fetch;
      global.fetch = (async (url: unknown, init?: { headers?: Record<string, string>; body?: string }) => {
        calls.push({ url: String(url), headers: init?.headers ?? {}, body: String(init?.body ?? "") });
        return new Response(
          JSON.stringify({ content: [{ type: "text", text: "[AI] tóm tắt" }], usage: { input_tokens: 8, output_tokens: 4 } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch;
      try {
        const ev = await createEvidence({ title: "MC", criterionIds: [], requirementIds: [] });
        const draft = await summarizeEvidence(ev.id);
        expect(draft.content).toContain("[AI] tóm tắt");
        expect(calls.length).toBe(1);
        expect(calls[0].url).toContain("api.anthropic.com/v1/messages");
        expect(calls[0].headers["x-api-key"]).toBe("sk-ant-test-key");
        expect(calls[0].url).not.toContain("openai");
        // KHÔNG gửi temperature (model Claude 4.x báo lỗi nếu có).
        expect(calls[0].body).not.toContain("temperature");
      } finally {
        global.fetch = orig;
      }
    });
  });

  it("AI soạn/cải thiện một mục đề cương -> trả bản nháp, KHÔNG tự lưu vào học phần", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const course = await prisma.course.create({ data: { tenantId: t.id, code: "TMAE306", name: "TMĐT", credits: 3 } });
      const text = await draftCourseField(course.id, "assessmentMethods");
      expect(text).toContain("[AI-nháp]");
      // Human-in-the-loop: chưa ghi vào học phần.
      const fresh = await prisma.course.findFirstOrThrow({ where: { id: course.id } });
      expect(fresh.assessmentMethods).toBeNull();
    });
  });

  it("AI điền nhanh đề cương: chỉ xử lý mục trống, KHÔNG tự lưu; đủ mục -> bỏ qua AI", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const course = await prisma.course.create({ data: { tenantId: t.id, code: "TMAE306", name: "TMĐT", credits: 3 } });
      const fields = await draftFullSyllabus(course.id);
      expect(typeof fields).toBe("object"); // trả map field->text (chưa ghi)
      const fresh = await prisma.course.findFirstOrThrow({ where: { id: course.id } });
      expect(fresh.description).toBeNull(); // human-in-the-loop

      // Học phần đã đủ nội dung -> không có mục trống -> trả {} (không gọi AI).
      const full = await prisma.course.create({
        data: {
          tenantId: t.id, code: "FULL1", name: "x", credits: 3,
          description: "a", prerequisites: "b", content: "c", teachingMethods: "d", assessmentMethods: "e", materials: "f",
        },
      });
      expect(await draftFullSyllabus(full.id)).toEqual({});
    });
  });

  it("AI rà soát đề cương trả về nhận xét (text)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      const course = await prisma.course.create({ data: { tenantId: t.id, code: "TMAE306", name: "TMĐT", credits: 3 } });
      const review = await reviewCourseSyllabus(course.id);
      expect(review.length).toBeGreaterThan(0);
    });
  });

  it("lấy danh sách model khả dụng từ key Anthropic (GET /v1/models)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, apiKey: "sk-ant-test" });
      const orig = global.fetch;
      const calls: string[] = [];
      global.fetch = (async (url: unknown) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ data: [{ id: "claude-3-5-haiku-20241022" }, { id: "claude-sonnet-4-5" }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;
      try {
        const r = await listProviderModels();
        expect(r.provider).toBe("anthropic");
        expect(r.models).toContain("claude-sonnet-4-5");
        expect(calls[0]).toContain("api.anthropic.com/v1/models");
      } finally { global.fetch = orig; }
    });
  });

  it("lấy danh sách model khi chưa có key -> báo lỗi rõ ràng", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true });
      await expect(listProviderModels()).rejects.toMatchObject({ status: 400 });
    });
  });

  it("aiCompleteJson chịu được output Claude bọc ```json + văn bản thừa (điền nhanh đề cương)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await updateSettings({ enabled: true, apiKey: "sk-ant-test" });
      const course = await prisma.course.create({ data: { tenantId: t.id, code: "DS1", name: "CTDL", credits: 3 } });
      const orig = global.fetch;
      const payload = {
        description: "Mô tả học phần…", prerequisites: "Toán rời rạc",
        content: "Chương 1…", teachingMethods: "Lecture + Lab",
        assessmentMethods: "Cuối kỳ 50%", materials: "[TL1] Cormen (2022)",
      };
      global.fetch = (async () =>
        new Response(
          JSON.stringify({ content: [{ type: "text", text: "Đây là kết quả:\n```json\n" + JSON.stringify(payload) + "\n```\nHy vọng giúp ích." }], usage: { input_tokens: 10, output_tokens: 50 } }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as typeof fetch;
      try {
        const fields = await draftFullSyllabus(course.id);
        expect(fields.description).toBe("Mô tả học phần…");
        expect(fields.assessmentMethods).toBe("Cuối kỳ 50%");
        expect(Object.keys(fields)).toHaveLength(6);
      } finally { global.fetch = orig; }
    });
  });

  it("cách ly tenant: bản nháp AI của A không thấy ở B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    const draftId = await asTenant(a.id, async () => {
      await updateSettings({ enabled: true });
      const ev = await createEvidence({ title: "MC", criterionIds: [], requirementIds: [] });
      return (await summarizeEvidence(ev.id)).id;
    });
    const inB = await asTenant(b.id, () => prisma.aiGeneratedDraft.findMany());
    expect(inB.find((d) => d.id === draftId)).toBeUndefined();
  });
});
