/**
 * RBAC khai báo bằng dữ liệu (đặc tả mục 9). Đây là catalog nguồn sự thật cho:
 *  - seed (tạo Permission/Role/RolePermission)
 *  - kiểm tra quyền ở server.
 * Thêm/sửa quyền = sửa ở đây rồi chạy lại seed (idempotent).
 */

export const PERMISSIONS = {
  DATA_VIEW: "data.view",
  DATA_CREATE: "data.create",
  DATA_UPDATE: "data.update",
  DATA_DELETE: "data.delete",
  EVIDENCE_UPLOAD: "evidence.upload",
  EVIDENCE_VERIFY: "evidence.verify",
  SAR_WRITE: "sar.write",
  SAR_REVIEW: "sar.review",
  INTERNAL_SCORE: "internal.score",
  CONTENT_APPROVE: "content.approve",
  REPORT_EXPORT: "report.export",
  STANDARD_MANAGE: "standard.manage",
  USER_MANAGE: "user.manage",
  AI_USE: "ai.use",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  "data.view": "Xem dữ liệu",
  "data.create": "Tạo mới",
  "data.update": "Cập nhật",
  "data.delete": "Xóa",
  "evidence.upload": "Upload minh chứng",
  "evidence.verify": "Xác minh minh chứng",
  "sar.write": "Viết SAR",
  "sar.review": "Rà soát SAR",
  "internal.score": "Chấm điểm nội bộ",
  "content.approve": "Phê duyệt nội dung",
  "report.export": "Xuất báo cáo",
  "standard.manage": "Quản trị bộ tiêu chuẩn",
  "user.manage": "Quản trị người dùng",
  "ai.use": "Sử dụng AI",
};

const P = PERMISSIONS;

export interface RoleDef {
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[];
}

/** Vai trò theo đặc tả mục 3. super_admin xử lý riêng (toàn quyền qua isSuperAdmin). */
export const ROLES: RoleDef[] = [
  {
    code: "super_admin",
    name: "Quản trị hệ thống",
    description: "Toàn quyền nền tảng, xuyên tenant",
    permissions: Object.values(P),
  },
  {
    code: "leadership",
    name: "Ban Giám hiệu / Lãnh đạo trường",
    description: "Xem dashboard tổng quan, xuất báo cáo tổng hợp",
    permissions: [P.DATA_VIEW, P.REPORT_EXPORT],
  },
  {
    code: "qa_office",
    name: "Phòng Khảo thí & Đảm bảo chất lượng",
    description: "Quản lý quy trình kiểm định toàn trường",
    permissions: [
      P.DATA_VIEW,
      P.DATA_CREATE,
      P.DATA_UPDATE,
      P.EVIDENCE_VERIFY,
      P.SAR_REVIEW,
      P.CONTENT_APPROVE,
      P.REPORT_EXPORT,
      P.STANDARD_MANAGE,
      P.USER_MANAGE,
      P.AI_USE,
    ],
  },
  {
    code: "faculty",
    name: "Khoa / Viện / Bộ môn",
    description: "Theo dõi, duyệt nội dung cấp khoa",
    permissions: [P.DATA_VIEW, P.DATA_UPDATE, P.CONTENT_APPROVE, P.REPORT_EXPORT, P.AI_USE],
  },
  {
    code: "programme_committee",
    name: "Ban Chủ nhiệm chương trình đào tạo",
    description: "Nhóm làm việc chính của chương trình",
    permissions: [
      P.DATA_VIEW,
      P.DATA_CREATE,
      P.DATA_UPDATE,
      P.EVIDENCE_UPLOAD,
      P.SAR_WRITE,
      P.REPORT_EXPORT,
      P.AI_USE,
    ],
  },
  {
    code: "lecturer",
    name: "Giảng viên / Chủ nhiệm học phần",
    description: "Cung cấp dữ liệu, minh chứng học phần được giao",
    permissions: [P.DATA_VIEW, P.DATA_UPDATE, P.EVIDENCE_UPLOAD, P.AI_USE],
  },
  {
    code: "internal_reviewer",
    name: "Thành viên hội đồng rà soát nội bộ",
    description: "Rà soát, chấm điểm nội bộ",
    permissions: [P.DATA_VIEW, P.SAR_REVIEW, P.INTERNAL_SCORE],
  },
  {
    code: "external_assessor",
    name: "Đánh giá viên ngoài / Khách",
    description: "Quyền xem giới hạn theo phân quyền",
    permissions: [P.DATA_VIEW],
  },
];

export const ALL_PERMISSION_CODES = Object.values(P);
