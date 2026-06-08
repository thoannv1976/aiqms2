import { authedRoute, superAdminRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import {
  createStandard,
  createStandardSchema,
  listStandards,
} from "@/lib/standards/service";

export const runtime = "nodejs";

// Đọc: mọi user có DATA_VIEW (bộ tiêu chuẩn là catalog dùng chung).
export const GET = authedRoute(async () => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  return ok(await listStandards());
});

// Ghi: chỉ super-admin (cấu hình nền tảng — thêm chuẩn = nạp dữ liệu).
export const POST = superAdminRoute(async (req) => {
  const input = await parseBody(req, createStandardSchema);
  return created(await createStandard(input));
});
