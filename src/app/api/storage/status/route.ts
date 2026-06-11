import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { storageStatus } from "@/lib/storage";

export const runtime = "nodejs";

// Trạng thái kho lưu trữ: bền vững (GCS/S3) hay tạm (local /tmp trên Cloud Run).
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(storageStatus());
});
