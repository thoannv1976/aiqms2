import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runWithTenant } from "@/lib/tenant/context";
import { createTenant, prisma, resetDb, writeAudit } from "../helpers/db";

/**
 * Test cách ly tenant (BẮT BUỘC — bài học #4): trường A không bao giờ thấy dữ liệu
 * trường B. Chạy trên Postgres thật.
 */
describe("Cách ly tenant qua Prisma extension", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("findMany chỉ trả dữ liệu của tenant trong context", async () => {
    const a = await createTenant("truong-a");
    const b = await createTenant("truong-b");

    await runWithTenant({ tenantId: a.id }, () =>
      writeAudit({ action: "x", entity: "Test" }),
    );
    await runWithTenant({ tenantId: b.id }, () =>
      writeAudit({ action: "y", entity: "Test" }),
    );

    const seenByA = await runWithTenant({ tenantId: a.id }, () =>
      prisma.auditLog.findMany(),
    );
    const seenByB = await runWithTenant({ tenantId: b.id }, () =>
      prisma.auditLog.findMany(),
    );

    expect(seenByA).toHaveLength(1);
    expect(seenByA[0].action).toBe("x");
    expect(seenByB).toHaveLength(1);
    expect(seenByB[0].action).toBe("y");
  });

  it("create tự gán tenantId từ context (không cần truyền tay)", async () => {
    const a = await createTenant("truong-a");
    const log = await runWithTenant({ tenantId: a.id }, () =>
      writeAudit({ action: "z", entity: "Test" }),
    );
    expect(log.tenantId).toBe(a.id);
  });

  it("findUnique hậu-kiểm tenant: trả null nếu bản ghi thuộc tenant khác", async () => {
    const a = await createTenant("truong-a");
    const b = await createTenant("truong-b");
    const logA = await runWithTenant({ tenantId: a.id }, () =>
      writeAudit({ action: "x", entity: "Test" }),
    );

    const fromB = await runWithTenant({ tenantId: b.id }, () =>
      prisma.auditLog.findUnique({ where: { id: logA.id } }),
    );
    expect(fromB).toBeNull();

    const fromA = await runWithTenant({ tenantId: a.id }, () =>
      prisma.auditLog.findUnique({ where: { id: logA.id } }),
    );
    expect(fromA?.id).toBe(logA.id);
  });

  it("update/delete không chạm được bản ghi tenant khác", async () => {
    const a = await createTenant("truong-a");
    const b = await createTenant("truong-b");
    const logA = await runWithTenant({ tenantId: a.id }, () =>
      writeAudit({ action: "x", entity: "Test" }),
    );

    // Tenant B cố xóa bản ghi của A -> deleteMany ảnh hưởng 0 dòng.
    const del = await runWithTenant({ tenantId: b.id }, () =>
      prisma.auditLog.deleteMany({ where: { id: logA.id } }),
    );
    expect(del.count).toBe(0);

    // Bản ghi của A vẫn còn.
    const still = await runWithTenant({ tenantId: a.id }, () =>
      prisma.auditLog.findUnique({ where: { id: logA.id } }),
    );
    expect(still?.id).toBe(logA.id);
  });

  it("truy vấn model tenant-scoped ngoài context -> ném lỗi rõ ràng", async () => {
    await expect(prisma.auditLog.findMany()).rejects.toThrow(
      /tenant context/i,
    );
  });

  it("bypassTenant (super-admin/seed) thấy mọi tenant", async () => {
    const a = await createTenant("truong-a");
    const b = await createTenant("truong-b");
    await runWithTenant({ tenantId: a.id }, () =>
      writeAudit({ action: "x", entity: "Test" }),
    );
    await runWithTenant({ tenantId: b.id }, () =>
      writeAudit({ action: "y", entity: "Test" }),
    );

    const all = await runWithTenant(
      { tenantId: a.id, bypassTenant: true },
      () => prisma.auditLog.findMany(),
    );
    expect(all).toHaveLength(2);
  });
});
