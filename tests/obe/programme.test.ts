import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture } from "../helpers/fixtures";
import { runWithTenant } from "@/lib/tenant/context";
import {
  addClo,
  createCourse,
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
