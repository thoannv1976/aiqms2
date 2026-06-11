import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma/client";
import { notFound } from "@/lib/http/responses";
import { listCycleTasks } from "@/lib/cycle-plan/service";

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };

/** Xuất BẢNG PHÂN CÔNG của một đợt tự đánh giá ra Excel (.xlsx). */
export async function buildCycleAssignmentXlsx(cycleId: string): Promise<Buffer> {
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const tasks = await listCycleTasks(cycleId);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Phân công");
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `BẢNG PHÂN CÔNG CÔNG VIỆC — Đợt: ${cycle.name}${cycle.year ? ` (${cycle.year})` : ""}`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.addRow([]);

  ws.columns = [
    { key: "stt", width: 6 },
    { key: "task", width: 46 },
    { key: "crit", width: 9 },
    { key: "assignee", width: 24 },
    { key: "deliverables", width: 44 },
    { key: "due", width: 13 },
    { key: "status", width: 13 },
    { key: "files", width: 12 },
  ];
  const header = ws.addRow(["STT", "Công việc", "Tiêu chí", "Người phụ trách", "Minh chứng phải nộp", "Hạn", "Trạng thái", "MC đã nộp"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }; });

  tasks.forEach((t, i) => {
    ws.addRow([
      i + 1,
      t.title,
      t.criterionCode ?? "—",
      t.assigneeName ?? "(chưa giao)",
      t.deliverables ?? "",
      t.dueDate ? new Date(t.dueDate).toLocaleDateString("vi-VN") : "",
      STATUS_VI[t.status] ?? t.status,
      t.fileCount,
    ]);
  });
  ws.eachRow((row) => row.eachCell((c) => { c.alignment = { vertical: "top", wrapText: true }; }));

  // Sheet tổng hợp theo người phụ trách.
  const ws2 = wb.addWorksheet("Theo người");
  ws2.columns = [
    { header: "Người phụ trách", key: "name", width: 28 },
    { header: "Số việc", key: "count", width: 10 },
    { header: "Đã xong", key: "done", width: 10 },
    { header: "Độ ưu tiên cao", key: "high", width: 16 },
  ];
  ws2.getRow(1).font = { bold: true };
  const byName = new Map<string, { count: number; done: number; high: number }>();
  for (const t of tasks) {
    const k = t.assigneeName ?? "(chưa giao)";
    const e = byName.get(k) ?? { count: 0, done: 0, high: 0 };
    e.count++; if (t.status === "done") e.done++; if (t.priority === "high") e.high++;
    byName.set(k, e);
  }
  for (const [name, e] of byName) ws2.addRow({ name, count: e.count, done: e.done, high: e.high });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
