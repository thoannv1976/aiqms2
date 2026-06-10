import JSZip from "jszip";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { applyExtractedProgramme, docxToText, extractByRules } from "@/lib/import/docx";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

function p(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}
function courseRow(code: string, name: string, credits: string): string {
  const cell = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  return `<w:tr>${cell(code)}${cell(name)}${cell(credits)}</w:tr>`;
}
async function buildDocx(): Promise<Buffer> {
  const body = [
    p("Mã ngành: 7340122"),
    p("Tên ngành: Thương mại điện tử"),
    p("Tổng số tín chỉ: 130"),
    p("PEO1: Có phẩm chất chính trị và đạo đức nghề nghiệp tốt."),
    p("PLO1: Vận dụng kiến thức nền tảng để học tập và làm việc."),
    p("PLO2: Phân tích môi trường kinh doanh số."),
    p("PLO3: Áp dụng kiến thức chuyên sâu về thương mại điện tử."),
    `<w:tbl>${courseRow("TMAE306", "Thương mại điện tử căn bản", "3")}${courseRow("SBIE201", "Trí tuệ kinh doanh", "3")}</w:tbl>`,
  ].join("");
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  const zip = new JSZip();
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("Import CTĐT từ Word (.docx)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("docxToText: lấy text + ngắt đoạn + ô bảng theo tab", async () => {
    const text = await docxToText(await buildDocx());
    expect(text).toContain("Mã ngành: 7340122");
    expect(text).toContain("PLO1:");
    expect(text).toMatch(/TMAE306\t/); // ô bảng tách bằng tab
  });

  it("extractByRules: trích mã, tổng TC, PLO/PEO và học phần", async () => {
    const data = extractByRules(await docxToText(await buildDocx()));
    expect(data.code).toBe("7340122");
    expect(data.totalCredits).toBe(130);
    expect(data.plos.map((x) => x.code)).toEqual(["PLO1", "PLO2", "PLO3"]);
    expect(data.peos.map((x) => x.code)).toEqual(["PEO1"]);
    const codes = data.courses.map((c) => c.code);
    expect(codes).toContain("TMAE306");
    expect(codes).toContain("SBIE201");
    expect(data.courses.find((c) => c.code === "TMAE306")?.credits).toBe(3);
  });

  it("applyExtractedProgramme: ghi CTĐT + phiên bản + PEO/PLO + học phần (idempotent)", async () => {
    const t = await createTenantFixture("demo");
    const data = extractByRules(await docxToText(await buildDocx()));
    const res = await asTenant(t.id, () => applyExtractedProgramme(data));
    expect(res.details.programmes).toBe(1);
    expect(res.details.plos).toBe(3);

    const prog = await asTenant(t.id, () =>
      prisma.programme.findFirst({ where: { code: "7340122" }, include: { versions: { include: { plos: true, peos: true } } } }),
    );
    expect(prog?.totalCredits).toBe(130);
    expect(prog?.versions[0].plos).toHaveLength(3);
    expect(prog?.versions[0].peos).toHaveLength(1);
    const courses = await asTenant(t.id, () => prisma.course.findMany());
    expect(courses.map((c) => c.code).sort()).toEqual(["SBIE201", "TMAE306"]);

    // Nạp lại: cập nhật, không nhân bản PLO/CTĐT.
    const res2 = await asTenant(t.id, () => applyExtractedProgramme(data));
    expect(res2.updated).toBe(1);
    const plos = await asTenant(t.id, () => prisma.programmeLearningOutcome.findMany());
    expect(plos).toHaveLength(3);
  });
});
