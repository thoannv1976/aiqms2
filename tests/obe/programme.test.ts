import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import {
  addClo,
  createCourse,
  deleteCoursesBulk,
  listCourses,
  updateCourse,
} from "@/lib/courses/service";
import {
  addPlo,
  changeVersionStatus,
  createProgramme,
} from "@/lib/programmes/service";
import { mapCloPlo, mapPloCourse, ploCourseMatrix } from "@/lib/obe/matrix";
import { coverageWarnings } from "@/lib/obe/coverage";

function asTenant<T>(tenantId: string, fn: () => Promise<T>) {
  return runWithTenant({ tenantId, actorId: "tester" }, fn);
}

describe("P3 — Chương trình đào tạo + OBE", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("listCourses làm giàu (cloCount/extracted/người tạo) + xóa nhiều học phần", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const c1 = await createCourse({ code: "AINE100", name: "AI", credits: 3 });
      const c2 = await createCourse({ code: "AINE110", name: "Python", credits: 3 });
      await addClo(c1.id, { code: "CLO1", description: "x", order: 1 }); // c1 -> đã có CLO -> extracted

      const p1 = await listCourses({ page: 1, pageSize: 20, skip: 0, take: 20 });
      const r1 = p1.items.find((c) => c.id === c1.id)!;
      const r2 = p1.items.find((c) => c.id === c2.id)!;
      expect(r1.cloCount).toBe(1);
      expect(r1.extracted).toBe(true);
      expect(r2.extracted).toBe(false);
      expect(r1.createdByName !== undefined).toBe(true);

      const del = await deleteCoursesBulk([c1.id, c2.id]);
      expect(del.deleted).toBe(2);
      const p2 = await listCourses({ page: 1, pageSize: 20, skip: 0, take: 20 });
      expect(p2.items.find((c) => c.id === c1.id || c.id === c2.id)).toBeUndefined();
    });
  });

  it("tạo CTĐT kèm phiên bản đầu; vòng đời trạng thái", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({
        code: "IT",
        name: "Công nghệ thông tin",
        level: "bachelor",
        initialVersion: "2024",
      });
      const versionId = prog.versions[0].id;
      expect(prog.versions[0].status).toBe("draft");

      const active = await changeVersionStatus(versionId, "active");
      expect(active.status).toBe("active");

      // draft -> active hợp lệ; active -> draft không hợp lệ.
      await expect(changeVersionStatus(versionId, "draft")).rejects.toThrow(
        /invalid_transition|Không thể chuyển/,
      );
    });
  });

  it("ma trận PLO-học phần + CLO-PLO hoạt động", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const vId = prog.versions[0].id;
      const plo = await addPlo(vId, { code: "PLO1", description: "Lập trình", order: 1 });
      const course = await createCourse({ code: "CS101", name: "Nhập môn lập trình", credits: 3 });
      const clo = await addClo(course.id, { code: "CLO1", description: "Viết chương trình", order: 1 });

      await mapPloCourse({ ploId: plo.id, courseId: course.id, level: "I" });
      await mapCloPlo({ cloId: clo.id, ploId: plo.id });

      const matrix = await ploCourseMatrix(vId);
      expect(matrix).toHaveLength(1);
      expect(matrix[0].courses[0].code).toBe("CS101");
      expect(matrix[0].courses[0].level).toBe("I");
    });
  });

  it("cảnh báo độ phủ: PLO không có học phần/CLO, CLO mồ côi", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const vId = prog.versions[0].id;
      await addPlo(vId, { code: "PLO1", description: "x", order: 1 }); // không map gì
      const course = await createCourse({ code: "CS101", name: "x", credits: 3 });
      await addClo(course.id, { code: "CLO1", description: "y", order: 1 }); // CLO mồ côi

      const warnings = await coverageWarnings(vId);
      const types = warnings.map((w) => w.type);
      expect(types).toContain("plo_no_course");
      expect(types).toContain("plo_no_clo");
      expect(types).toContain("clo_no_plo");
    });
  });

  it("lưu đề cương với mục trống (null) không lỗi schema (AI điền nháp rồi lưu)", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const c = await createCourse({ code: "CS1", name: "x", credits: 3 });
      const updated = await updateCourse(c.id, {
        description: "Mô tả do AI soạn", content: "Chương 1…",
        rubric: null, materials: null, prerequisites: null,
      });
      expect(updated.description).toBe("Mô tả do AI soạn");
      expect(updated.rubric).toBeNull();
    });
  });

  it("gán học phần vào CTĐT: lọc theo programmeId + hiển thị programme", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, async () => {
      const prog = await createProgramme({ code: "SBI", name: "TMĐT", level: "bachelor", initialVersion: "2026" });
      const c1 = await createCourse({ code: "TMAE306", name: "TMĐT", credits: 3, programmeId: prog.id });
      await createCourse({ code: "FREE1", name: "Tự do", credits: 3 }); // chưa gán

      expect(c1.programmeId).toBe(prog.id);

      const inProg = await listCourses({ page: 1, pageSize: 20, skip: 0, take: 20 }, { programmeId: prog.id });
      expect(inProg.items.map((c) => c.code)).toEqual(["TMAE306"]);
      expect(inProg.items[0].programme?.code).toBe("SBI");

      const none = await listCourses({ page: 1, pageSize: 20, skip: 0, take: 20 }, { programmeId: "none" });
      expect(none.items.map((c) => c.code)).toEqual(["FREE1"]);

      // Đổi gán qua updateCourse.
      const moved = await updateCourse(c1.id, { programmeId: null });
      expect(moved.programmeId).toBeNull();
    });
  });

  it("cách ly tenant: CTĐT trường A không lọt sang B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await asTenant(a.id, () =>
      createProgramme({ code: "IT", name: "A-CNTT", level: "bachelor", initialVersion: "2024" }),
    );
    const inB = await asTenant(b.id, () => prisma.programme.findMany());
    expect(inB).toHaveLength(0);

    // B có thể tạo cùng mã "IT" (unique theo tenant) mà không xung đột.
    const progB = await asTenant(b.id, () =>
      createProgramme({ code: "IT", name: "B-CNTT", level: "bachelor", initialVersion: "2024" }),
    );
    expect(progB.name).toBe("B-CNTT");
  });
});
