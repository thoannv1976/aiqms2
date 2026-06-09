import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import {
  createAcademicStaff,
  createFacility,
  createOutcome,
  createStudentService,
  listAcademicStaff,
  listFacilities,
} from "@/lib/institutional/service";

const asTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId: "u1" }, fn);

describe("Module dữ liệu kiểm định (C5–C8)", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("tạo + liệt kê đội ngũ giảng viên / CSVC / outcomes / hỗ trợ người học", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      await createAcademicStaff({ fullName: "Nguyễn Văn A", academicRank: "PGS", degree: "TS", publications: 12 });
      await createFacility({ name: "Phòng LAB1", type: "lab", quantity: 2 });
      await createOutcome({ name: "Tỷ lệ việc làm", category: "employment", value: 92, unit: "%" });
      await createStudentService({ category: "scholarship", title: "Học bổng KKHT" });

      const staff = await listAcademicStaff({ page: 1, pageSize: 20, skip: 0, take: 20 });
      expect(staff.total).toBe(1);
      expect(staff.items[0].publications).toBe(12);

      const fac = await listFacilities({ page: 1, pageSize: 20, skip: 0, take: 20 });
      expect(fac.total).toBe(1);
    });
  });

  it("lưu được các chỉ số AUN-QA bổ sung (FTE, diện tích, mục tiêu/đối sánh…)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const gv = await createAcademicStaff({
        fullName: "GS B", publications: 5, fte: 1, employmentType: "full_time", gender: "male", recruitedYear: 2018,
      });
      expect(gv.fte).toBe(1);
      expect(gv.employmentType).toBe("full_time");

      const fac = await createFacility({ name: "Giảng đường A", type: "classroom", area: 120, condition: "good", utilizationRate: 80 });
      expect(fac.area).toBe(120);
      expect(fac.condition).toBe("good");

      const out = await createOutcome({ name: "Tỷ lệ tốt nghiệp đúng hạn", category: "graduation", value: 85, target: 90, benchmark: 80, cohort: "K60" });
      expect(out.target).toBe(90);
      expect(out.benchmark).toBe(80);

      const svc = await createStudentService({ category: "career", title: "Ngày hội việc làm", beneficiaries: 300, responsibleUnit: "Phòng CTSV" });
      expect(svc.beneficiaries).toBe(300);
    });
  });

  it("cách ly tenant: dữ liệu trường A không lọt sang B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await asTenant(a.id, () => createAcademicStaff({ fullName: "GV A", publications: 0 }));
    const inB = await asTenant(b.id, () => prisma.academicStaff.findMany());
    expect(inB).toHaveLength(0);
  });
});
