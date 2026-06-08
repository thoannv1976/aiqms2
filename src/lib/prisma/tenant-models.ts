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
  // P2+: AccreditationStandard, StandardVersion, Criterion, Requirement, ...
]);

export function isTenantScoped(model: string | undefined): boolean {
  return !!model && TENANT_SCOPED_MODELS.has(model);
}
