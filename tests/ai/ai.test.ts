import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { encryptSecret, decryptSecret } from "@/lib/ai/crypto";
import { getSettings, updateSettings } from "@/lib/ai/settings";
import {
  approveDraft,
  draftSarCriterion,
  gapCheck,
  summarizeEvidence,
  assistantAnswer,
} from "@/lib/ai/features";
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

  it("AI tắt -> tính năng bị chặn (403)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
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
