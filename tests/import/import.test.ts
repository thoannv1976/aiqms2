import ExcelJS from "exceljs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import { importCourses, importInstitutional, importMatrix, importProgrammes } from "@/lib/import/excel";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

async function xlsx(sheets: Record<string, (string | number)[][]>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    rows.forEach((r) => ws.addRow(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("Import Excel — CTĐT & đề cương học phần", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("nạp CTĐT + PEO + PLO từ Excel", async () => {
    const t = await createTenantFixture("demo");
    const buf = await xlsx({
      ChuongTrinh: [
        ["Mã CTĐT", "Tên chương trình", "Trình độ", "Tổng tín chỉ", "Phiên bản"],
        ["IMP-IT", "CNTT Import", "Đại học", 130, "2024"],
      ],
      PEO: [["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"], ["IMP-IT", "2024", "PEO1", "Mục tiêu 1"]],
      PLO: [
        ["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"],
        ["IMP-IT", "2024", "PLO1", "Lập trình"],
        ["IMP-IT", "2024", "PLO2", "Làm việc nhóm"],
      ],
    });
    const res = await asTenant(t.id, () => importProgrammes(buf));
    expect(res.created).toBe(1);
    expect(res.details.plos).toBe(2);

    const prog = await asTenant(t.id, () =>
      prisma.programme.findFirst({ where: { code: "IMP-IT" }, include: { versions: { include: { plos: true, peos: true } } } }),
    );
    expect(prog?.totalCredits).toBe(130);
    expect(prog?.versions[0].plos).toHaveLength(2);
    expect(prog?.versions[0].peos).toHaveLength(1);
  });

  it("nạp lại idempotent (cập nhật, không nhân bản PLO)", async () => {
    const t = await createTenantFixture("demo");
    const build = () => xlsx({
      ChuongTrinh: [["Mã CTĐT", "Tên chương trình", "Phiên bản"], ["IMP-IT", "CNTT", "2024"]],
      PLO: [["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"], ["IMP-IT", "2024", "PLO1", "v1"]],
    });
    await asTenant(t.id, async () => { await importProgrammes(await build()); });
    const buf2 = await xlsx({
      ChuongTrinh: [["Mã CTĐT", "Tên chương trình", "Phiên bản"], ["IMP-IT", "CNTT", "2024"]],
      PLO: [["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"], ["IMP-IT", "2024", "PLO1", "v2-mô tả cập nhật"]],
    });
    const res2 = await asTenant(t.id, () => importProgrammes(buf2));
    expect(res2.updated).toBe(1); // CTĐT đã tồn tại
    const plos = await asTenant(t.id, () => prisma.programmeLearningOutcome.findMany());
    expect(plos).toHaveLength(1);
    expect(plos[0].description).toBe("v2-mô tả cập nhật");
  });

  it("nạp đề cương học phần + CLO từ Excel", async () => {
    const t = await createTenantFixture("demo");
    const buf = await xlsx({
      HocPhan: [
        ["Mã học phần", "Tên học phần", "Số tín chỉ", "Phương pháp đánh giá"],
        ["CS101", "Nhập môn lập trình", 3, "Giữa kỳ 40% + cuối kỳ 60%"],
      ],
      CLO: [["Mã học phần", "Mã", "Mô tả"], ["CS101", "CLO1", "Viết chương trình cơ bản"]],
    });
    const res = await asTenant(t.id, () => importCourses(buf));
    expect(res.created).toBe(1);
    expect(res.details.clos).toBe(1);
    const course = await asTenant(t.id, () =>
      prisma.course.findFirst({ where: { code: "CS101" }, include: { clos: true } }),
    );
    expect(course?.assessmentMethods).toContain("cuối kỳ");
    expect(course?.clos).toHaveLength(1);
  });

  it("nạp ma trận PLO–học phần (I/R/M) & CLO–PLO từ Excel", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      // Chuẩn bị CTĐT + PLO + học phần + CLO.
      await importProgrammes(await xlsx({
        ChuongTrinh: [["Mã CTĐT", "Tên chương trình", "Phiên bản"], ["MX", "CT MX", "2024"]],
        PLO: [["Mã CTĐT", "Phiên bản", "Mã", "Mô tả"], ["MX", "2024", "PLO1", "x"]],
      }));
      await importCourses(await xlsx({
        HocPhan: [["Mã học phần", "Tên học phần", "Số tín chỉ"], ["CS101", "HP1", 3]],
        CLO: [["Mã học phần", "Mã", "Mô tả"], ["CS101", "CLO1", "y"]],
      }));
      const res = await importMatrix(await xlsx({
        MaTranPLO: [["Mã PLO", "Mã học phần", "Mức (I/R/M)"], ["PLO1", "CS101", "Củng cố"]],
        CLO_PLO: [["Mã học phần", "Mã CLO", "Mã PLO"], ["CS101", "CLO1", "PLO1"]],
      }));
      expect(res.details.plo_course).toBe(1);
      expect(res.details.clo_plo).toBe(1);
      const m = await prisma.ploCourseMapping.findFirst();
      expect(m?.level).toBe("R"); // "Củng cố" -> R
      expect(await prisma.cloPloMapping.count()).toBe(1);
    });
  });

  it("nạp dữ liệu C5–C8 từ Excel (đội ngũ / người học / CSVC / kết quả)", async () => {
    const t = await createTenantFixture("demo");
    const buf = await xlsx({
      C5_GiangVien: [["Họ tên", "Học vị", "FTE", "Hình thức", "Giới tính"], ["GV Nguyễn A", "TS", 1, "Toàn thời gian", "Nam"]],
      C6_NguoiHoc: [["Nhóm", "Nội dung", "Số người hưởng lợi"], ["Học bổng", "Học bổng KKHT", 100]],
      C7_CoSoVatChat: [["Tên", "Loại", "Diện tích", "Tình trạng"], ["Phòng máy A1", "Phòng máy", 80, "Tốt"]],
      C8_KetQua: [["Tên chỉ số", "Nhóm", "Giá trị", "Mục tiêu"], ["Tỷ lệ tốt nghiệp", "Tốt nghiệp", 88, 90]],
    });
    const res = await asTenant(t.id, () => importInstitutional(buf));
    expect(res.details).toMatchObject({ staff: 1, students: 1, facilities: 1, outcomes: 1 });
    await asTenant(t.id, async () => {
      const gv = await prisma.academicStaff.findFirst();
      expect(gv?.employmentType).toBe("full_time"); // "Toàn thời gian" -> full_time
      const fac = await prisma.facility.findFirst();
      expect(fac?.type).toBe("lab"); // "Phòng máy" -> lab
      const out = await prisma.outcomeMetric.findFirst();
      expect(out?.category).toBe("graduation");
      const svc = await prisma.studentService.findFirst();
      expect(svc?.category).toBe("scholarship");
    });
  });

  it("báo lỗi rõ ràng khi PLO tham chiếu CTĐT không tồn tại", async () => {
    const t = await createTenantFixture("demo");
    const buf = await xlsx({
      ChuongTrinh: [["Mã CTĐT", "Tên chương trình"], ["A", "CT A"]],
      PLO: [["Mã CTĐT", "Mã", "Mô tả"], ["KHONG-TON-TAI", "PLO1", "x"]],
    });
    const res = await asTenant(t.id, () => importProgrammes(buf));
    expect(res.errors.some((e) => e.includes("KHONG-TON-TAI"))).toBe(true);
  });
});
