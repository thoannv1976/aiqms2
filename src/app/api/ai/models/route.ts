import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { listProviderModels } from "@/lib/ai/service";

export const runtime = "nodejs";

// Lấy danh sách model khả dụng từ API key đã lưu (để chọn đúng model cho tài khoản).
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.AI_USE);
  return ok(await listProviderModels());
});
