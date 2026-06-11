import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { createDocument, downloadDocument, listDocumentVersions, listDocuments, promoteDocumentToEvidence, uploadNewVersion } from "@/lib/documents/service";
import { fileCountByTask } from "@/lib/tasks/service";

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

  it("nộp minh chứng gắn vào công việc (taskId) + lọc & đếm theo task", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await createDocument({ title: "MC1", category: "task_evidence", taskId: "task-1" }, { fileName: "a.pdf", body: Buffer.from("x") });
      await createDocument({ title: "MC2", category: "task_evidence", taskId: "task-1" }, { fileName: "b.pdf", body: Buffer.from("y") });
      await createDocument({ title: "MC khác", category: "task_evidence", taskId: "task-2" }, { fileName: "c.pdf", body: Buffer.from("z") });

      const byTask1 = await listDocuments({ page: 1, pageSize: 20, skip: 0, take: 20 }, { taskId: "task-1" });
      expect(byTask1.total).toBe(2);

      const counts = await fileCountByTask(["task-1", "task-2", "task-3"]);
      expect(counts.get("task-1")).toBe(2);
      expect(counts.get("task-2")).toBe(1);
      expect(counts.get("task-3")).toBeUndefined();
    });
  });

  it("đưa file nộp ở task vào hồ sơ minh chứng: tạo Evidence MC-XXXX + đính kèm file", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const task = await prisma.task.create({ data: { tenantId: t.id, title: "Thu thập C1", type: "cycle" } });
      const doc = await createDocument(
        { title: "Biên bản họp", category: "task_evidence", taskId: task.id },
        { fileName: "bb.pdf", body: Buffer.from("noi dung bb") },
      );
      const r = await promoteDocumentToEvidence(doc.id);
      expect(r.code).toMatch(/^MC-\d{4}$/);
      const ev = await prisma.evidence.findFirstOrThrow({ where: { id: r.evidenceId }, include: { files: true } });
      expect(ev.title).toBe("Biên bản họp");
      expect(ev.files).toHaveLength(1);
      // Tài liệu được đánh dấu đã đưa vào hồ sơ.
      const fresh = await prisma.document.findFirstOrThrow({ where: { id: doc.id } });
      expect(fresh.note).toContain(r.code);
    });
  });

  it("quản lý phiên bản tài liệu: tải bản mới → chỉ bản hiện hành hiển thị, lịch sử đủ chuỗi (D10)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const v1 = await createDocument({ title: "Quy chế ĐT", category: "regulation" }, { fileName: "qc-v1.docx", body: Buffer.from("ban 1") });
      expect(v1.version).toBe(1);
      expect(v1.isCurrent).toBe(true);

      const v2 = await uploadNewVersion(v1.id, { fileName: "qc-v2.docx", body: Buffer.from("ban 2 cap nhat") });
      expect(v2.version).toBe(2);
      expect(v2.rootId).toBe(v1.id);

      // Tải tiếp bản 3 từ bản 2 (chuỗi vẫn cùng root).
      const v3 = await uploadNewVersion(v2.id, { fileName: "qc-v3.docx", body: Buffer.from("ban 3") });
      expect(v3.version).toBe(3);
      expect(v3.rootId).toBe(v1.id);

      // Danh sách chỉ còn 1 dòng (bản hiện hành = v3).
      const page = await listDocuments({ page: 1, pageSize: 20, skip: 0, take: 20 }, { category: "regulation" });
      expect(page.total).toBe(1);
      expect(page.items[0].id).toBe(v3.id);

      // Lịch sử đủ 3 bản, chỉ v3 là hiện hành.
      const history = await listDocumentVersions(v1.id);
      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(3);
      expect(history.filter((h) => h.isCurrent)).toHaveLength(1);
      expect(history.find((h) => h.isCurrent)?.id).toBe(v3.id);
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
