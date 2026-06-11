import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { buildTeamTasksXlsx, buildTeamTasksDocx } from "@/lib/export/team-tasks-export";

export const runtime = "nodejs";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

// Tải trực tiếp công việc toàn đội (quản lý) — cần quyền xuất báo cáo.
export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.REPORT_EXPORT);
  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "xlsx";
  const body = format === "docx" ? await buildTeamTasksDocx() : await buildTeamTasksXlsx();
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename="cong-viec-toan-doi.${format}"`,
    },
  });
});
