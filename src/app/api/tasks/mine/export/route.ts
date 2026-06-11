import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { buildMyTasksXlsx, buildMyTasksDocx } from "@/lib/export/my-tasks-export";

export const runtime = "nodejs";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

// Xuất công việc của chính người dùng (mọi vai trò đăng nhập đều dùng được).
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "xlsx";
  const body = format === "docx" ? await buildMyTasksDocx() : await buildMyTasksXlsx();
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename="cong-viec-cua-toi.${format}"`,
    },
  });
});
