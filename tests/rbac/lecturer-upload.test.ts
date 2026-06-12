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
});
