import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import {
  addFile,
  createEvidence,
  listEvidence,
  mapCriterion,
  verifyEvidence,
} from "@/lib/evidence/service";

let criterionIds: string[];

function asTenant<T>(tenantId: string, fn: () => Promise<T>) {
  return runWithTenant({ tenantId, actorId: "u1" }, fn);
}

describe("P5 — Kho minh chứng", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    const v = await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } });
    const cs = await prisma.criterion.findMany({ where: { standardVersionId: v.id }, orderBy: { order: "asc" } });
    criterionIds = cs.map((c) => c.id);
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tự đánh mã MC-0001, MC-0002 tăng dần", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const e1 = await createEvidence({ title: "Đề cương", criterionIds: [], requirementIds: [] });
      const e2 = await createEvidence({ title: "Rubric", criterionIds: [], requirementIds: [] });
      expect(e1.code).toBe("MC-0001");
      expect(e2.code).toBe("MC-0002");
    });
  });

  it("một minh chứng liên kết nhiều tiêu chí", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const e = await createEvidence({
        title: "Đề cương học phần",
        criterionIds: [criterionIds[1], criterionIds[2], criterionIds[3]],
        requirementIds: [],
      });
      expect(e.criteria).toHaveLength(3);
    });
  });

  it("upload file: lưu qua Storage, tính hash, phát hiện trùng", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const e = await createEvidence({ title: "X", criterionIds: [], requirementIds: [] });
      const body = Buffer.from("noi dung minh chung");
      const r1 = await addFile(e.id, { fileName: "a.txt", body, contentType: "text/plain" });
      expect(r1.duplicateOf).toBeNull();
      expect(r1.file.size).toBe(body.byteLength);

      // Cùng nội dung -> phát hiện trùng (cùng hash).
      const e2 = await createEvidence({ title: "Y", criterionIds: [], requirementIds: [] });
      const r2 = await addFile(e2.id, { fileName: "b.txt", body });
      expect(r2.duplicateOf).toBe(e.id);
    });
  });

  it("xác minh minh chứng: đổi trạng thái + ghi log", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const e = await createEvidence({ title: "X", criterionIds: [], requirementIds: [] });
      const v = await verifyEvidence(e.id, { toStatus: "valid", note: "Đầy đủ" });
      expect(v.status).toBe("valid");
      const logs = await prisma.evidenceVerificationLog.findMany({ where: { evidenceId: e.id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].toStatus).toBe("valid");
    });
  });

  it("lọc minh chứng theo tiêu chí", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const e = await createEvidence({ title: "Có C1", criterionIds: [criterionIds[0]], requirementIds: [] });
      await mapCriterion(e.id, criterionIds[1]);
      await createEvidence({ title: "Không C1", criterionIds: [criterionIds[2]], requirementIds: [] });

      const res = await listEvidence({ page: 1, pageSize: 20, skip: 0, take: 20 }, { criterionId: criterionIds[0] });
      expect(res.total).toBe(1);
      expect(res.items[0].title).toBe("Có C1");
    });
  });

  it("cách ly tenant: minh chứng trường A không lọt sang B (mã đếm riêng)", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await asTenant(a.id, () => createEvidence({ title: "A1", criterionIds: [], requirementIds: [] }));
    const bFirst = await asTenant(b.id, () => createEvidence({ title: "B1", criterionIds: [], requirementIds: [] }));
    // B đếm riêng -> vẫn MC-0001.
    expect(bFirst.code).toBe("MC-0001");
    const inB = await asTenant(b.id, () => prisma.evidence.findMany());
    expect(inB).toHaveLength(1);
  });
});
