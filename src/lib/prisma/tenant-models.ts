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
  // P5: minh chứng.
  "Evidence",
  "EvidenceFile",
  "EvidenceLink",
  "EvidenceCriterionMapping",
  "EvidenceRequirementMapping",
  "EvidenceVerificationLog",
  // P6: nhiệm vụ + cải tiến PDCA.
  "Task",
  "TaskComment",
  "ImprovementPlan",
  "ImprovementAction",
  "ImprovementKpi",
  "ImprovementProgressLog",
  // P7: job xuất báo cáo.
  "ExportJob",
  // P8: lớp AI.
  "AiSettings",
  "AiRequest",
  "AiGeneratedDraft",
  // P9: khảo sát bên liên quan.
  "StakeholderGroup",
  "Survey",
  "SurveyQuestion",
  "SurveyResponse",
  // Module dữ liệu kiểm định (C5–C8).
  "AcademicStaff",
  "StudentService",
  "Facility",
  "OutcomeMetric",
  "Document",
  "PloMatrixCell",
  "Notification",
]);

export function isTenantScoped(model: string | undefined): boolean {
  return !!model && TENANT_SCOPED_MODELS.has(model);
}
