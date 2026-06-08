/**
 * Danh sách model có cột tenantId và phải được lọc tenant tự động.
 * Khi thêm bảng nghiệp vụ mới (có tenantId) ở các phase sau, BẮT BUỘC thêm tên
 * model vào đây — nếu không sẽ rò rỉ dữ liệu giữa các trường.
 *
 * Model registry như Tenant KHÔNG nằm ở đây (không có tenantId).
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  "AuditLog",
  // P1: assignment + đơn vị (Role/Permission/RolePermission là GLOBAL, không ở đây)
  "User",
  "UserRole",
  "Faculty",
  "Department",
  // P2: bộ tiêu chuẩn là GLOBAL -> KHÔNG nằm ở đây.
  // P3: chương trình đào tạo + OBE.
  "Programme",
  "ProgrammeVersion",
  "ProgrammeObjective",
  "ProgrammeLearningOutcome",
  "Course",
  "CourseLearningOutcome",
  "PloCourseMapping",
  "CloPloMapping",
  // P4: đợt tự đánh giá + SAR.
  "AssessmentCycle",
  "SelfAssessmentReport",
  "SarCriterionResponse",
  "SarComment",
  "InternalReview",
  "InternalReviewScore",
]);

export function isTenantScoped(model: string | undefined): boolean {
  return !!model && TENANT_SCOPED_MODELS.has(model);
}
