import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createDocument, downloadDocument, listDocuments } from "@/lib/documents/service";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("Kho tài liệu (upload/lưu trữ/quản lý)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("upload -> lưu file qua Storage + tải về đúng nội dung", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const doc = await createDocument(
        { title: "CTĐT SBI", category: "ctdt_source" },
        { fileName: "ctdt.docx", body: Buffer.from("noi dung file"), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      );
      expect(doc.size).toBe(Buffer.from("noi dung file").byteLength);
      expect(doc.storageKey).toContain(t.id);

      const dl = await downloadDocument(doc.id);
      expect(dl.body.toString()).toBe("noi dung file");
      expect(dl.fileName).toBe("ctdt.docx");

      const page = await listDocuments({ page: 1, pageSize: 20, skip: 0, take: 20 }, { category: "ctdt_source" });
      expect(page.total).toBe(1);
    });
  });

  it("cách ly tenant: tài liệu trường A không thấy ở B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await asTenant(a.id, () => createDocument({ title: "A doc", category: "other" }, { fileName: "a.txt", body: Buffer.from("x") }));
    const inB = await asTenant(b.id, () => listDocuments({ page: 1, pageSize: 20, skip: 0, take: 20 }));
    expect(inB.total).toBe(0);
  });
});
