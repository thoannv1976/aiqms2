import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle, createSar, getSar, updateCriterionResponse } from "@/lib/sar/service";
import { addFile, createEvidence } from "@/lib/evidence/service";
import { createExportJob, downloadJob, getJob } from "@/lib/export/jobs";
import { addAction, addKpi, createPlan } from "@/lib/improvement/service";

let aunVersionId: string;
const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b; // "PK"
const isPdf = (b: Buffer) => b.subarray(0, 4).toString() === "%PDF";

async function makeSar(tenantId: string) {
  return asTenant(tenantId, async () => {
    const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
    const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId });
    const sar = await createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR CNTT" });
    const detail = await getSar(sar.id);
    await updateCriterionResponse(detail.responses[0].id, { selfScore: 5, strengths: "Tốt", weaknesses: "Cần thêm minh chứng" });
    return sar;
  });
}

describe("P7 — Xuất báo cáo (background job)", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("xuất SAR ra Word (.docx) qua job; poll done + tải về", async () => {
    const t = await createTenantFixture("demo");
    const sar = await makeSar(t.id);
    await asTenant(t.id, async () => {
      const job = await createExportJob({ type: "sar_docx", sarId: sar.id });
      expect(job.status).toBe("done");
      expect(job.resultKey).toBeTruthy();
      const polled = await getJob(job.id);
      expect(polled.progress).toBe(100);
      const dl = await downloadJob(job.id);
      expect(isZip(dl.body)).toBe(true); // docx là zip container
      expect(dl.fileName).toMatch(/\.docx$/);
    });
  });

  it("xuất HỒ SƠ SAR đầy đủ (.docx) — có phụ lục ma trận/C5-C8/MC", async () => {
    const t = await createTenantFixture("demo");
    const sar = await makeSar(t.id);
    await asTenant(t.id, async () => {
      await createEvidence({ title: "MC dossier", criterionIds: [], requirementIds: [] });
      const job = await createExportJob({ type: "sar_dossier_docx", sarId: sar.id });
      expect(job.status).toBe("done");
      const dl = await downloadJob(job.id);
      expect(isZip(dl.body)).toBe(true);
      expect(dl.body.byteLength).toBeGreaterThan(2000);
    });
  });

  it("xuất SAR ra PDF", async () => {
    const t = await createTenantFixture("demo");
    const sar = await makeSar(t.id);
    await asTenant(t.id, async () => {
      const job = await createExportJob({ type: "sar_pdf", sarId: sar.id });
      expect(job.status).toBe("done");
      const dl = await downloadJob(job.id);
      expect(isPdf(dl.body)).toBe(true);
    });
  });

  it("xuất danh mục minh chứng ra Excel (.xlsx)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await createEvidence({ title: "MC1", criterionIds: [], requirementIds: [] });
      const job = await createExportJob({ type: "evidence_xlsx" });
      expect(job.status).toBe("done");
      const dl = await downloadJob(job.id);
      expect(isZip(dl.body)).toBe(true); // xlsx là zip container
    });
  });

  it("gói minh chứng thành .zip (kèm file thật)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const ev = await createEvidence({ title: "Có file", criterionIds: [], requirementIds: [] });
      await addFile(ev.id, { fileName: "a.txt", body: Buffer.from("noi dung") });
      const job = await createExportJob({ type: "evidence_zip" });
      expect(job.status).toBe("done");
      const dl = await downloadJob(job.id);
      expect(isZip(dl.body)).toBe(true);
      expect(dl.body.byteLength).toBeGreaterThan(0);
    });
  });

  it("xuất Kế hoạch cải tiến ra Word (.docx) — cần planId", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const plan = await createPlan({ title: "Cải tiến C1", issue: "Thiếu rà soát PLO", cause: "Chưa có quy trình" });
      await addAction(plan.id, { action: "Xây dựng quy trình rà soát PLO", pdcaPhase: "plan" });
      await addKpi(plan.id, { name: "Tỷ lệ PLO được rà soát", unit: "%", target: 100 });
      await expect(createExportJob({ type: "improvement_docx" })).resolves.toMatchObject({ status: "failed" });
      const job = await createExportJob({ type: "improvement_docx", planId: plan.id });
      expect(job.status).toBe("done");
      const dl = await downloadJob(job.id);
      expect(isZip(dl.body)).toBe(true); // docx là zip container
      expect(dl.fileName).toMatch(/\.docx$/);
    });
  });

  it("xuất tất cả Kế hoạch cải tiến ra Excel (.xlsx)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const plan = await createPlan({ title: "Cải tiến C2" });
      await addAction(plan.id, { action: "Hành động X", pdcaPhase: "do", responsibleUnit: "Khoa" });
      const job = await createExportJob({ type: "improvement_xlsx" });
      expect(job.status).toBe("done");
      const dl = await downloadJob(job.id);
      expect(isZip(dl.body)).toBe(true);
    });
  });

  it("cách ly tenant: job của trường A không thấy ở B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    const sar = await makeSar(a.id);
    const job = await asTenant(a.id, () => createExportJob({ type: "sar_docx", sarId: sar.id }));
    await expect(asTenant(b.id, () => getJob(job.id))).rejects.toThrow(/không tồn tại/i);
  });
});
