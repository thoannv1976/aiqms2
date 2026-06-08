import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getTenantContext } from "@/lib/tenant/context";

/**
 * Ghi audit log cho thao tác quan trọng (tạo/sửa/xóa/duyệt/chấm điểm/AI).
 *
 * tenantId do tenant extension tự gán theo context (cast `tenantId` được gói gọn
 * tại đây — đây là pattern chuẩn cho mọi entity tenant-scoped: lớp service chịu
 * một lần cast, business code không phải truyền tenantId tay).
 */
export async function writeAudit(input: {
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}) {
  const ctx = getTenantContext();
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actorId: ctx?.actorId,
      meta: input.meta,
    } as unknown as Prisma.AuditLogUncheckedCreateInput,
  });
}
