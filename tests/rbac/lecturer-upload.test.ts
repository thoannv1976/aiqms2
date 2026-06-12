import { describe, expect, it } from "vitest";
import { ROLES, PERMISSIONS } from "@/lib/rbac/permissions";

/** Khóa lại lý do bản vá: giảng viên nộp minh chứng bằng quyền EVIDENCE_UPLOAD (không có DATA_CREATE),
 *  nên endpoint nộp tài liệu phải chấp nhận EVIDENCE_UPLOAD chứ không chỉ DATA_CREATE. */
describe("RBAC — quyền nộp minh chứng của giảng viên", () => {
  const lecturer = ROLES.find((r) => r.code === "lecturer")!;

  it("lecturer CÓ evidence.upload nhưng KHÔNG có data.create", () => {
    expect(lecturer.permissions).toContain(PERMISSIONS.EVIDENCE_UPLOAD);
    expect(lecturer.permissions).not.toContain(PERMISSIONS.DATA_CREATE);
  });

  it("internal_reviewer KHÔNG có cả data.create lẫn evidence.upload → cần luồng 'người được giao việc'", () => {
    const reviewer = ROLES.find((r) => r.code === "internal_reviewer")!;
    expect(reviewer.permissions).not.toContain(PERMISSIONS.DATA_CREATE);
    expect(reviewer.permissions).not.toContain(PERMISSIONS.EVIDENCE_UPLOAD);
    // => endpoint nộp tài liệu phải cho phép người được giao task tự nộp minh chứng cho task đó.
  });

  it("faculty (trưởng khoa) có data.update → được nộp tài liệu trực tiếp", () => {
    const faculty = ROLES.find((r) => r.code === "faculty")!;
    expect(faculty.permissions).toContain(PERMISSIONS.DATA_UPDATE);
    expect(faculty.permissions).not.toContain(PERMISSIONS.DATA_CREATE);
  });
});
