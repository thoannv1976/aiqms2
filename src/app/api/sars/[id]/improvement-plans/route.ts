import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { created } from "@/lib/http/responses";
import { createPlansFromSarWeaknesses } from "@/lib/improvement/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// Tạo kế hoạch cải tiến từ điểm tồn tại + khoảng trống của SAR (C3/D6).
export const POST = authedRoute(async (_req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_CREATE);
  return created(await createPlansFromSarWeaknesses((await params).id));
});
