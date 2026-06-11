import ExcelJS from "exceljs";
import { Document, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import { listAllTasksForExport } from "@/lib/tasks/service";

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };
const PRIO_VI: Record<string, string> = { low: "Thấp", normal: "Bình thường", high: "Cao" };
const fmtDue = (d: Date | null) => (d ? new Date(d).toLocaleDateString("vi-VN") : "");
const UNASSIGNED = "(chưa giao)";

/** Xuất CÔNG VIỆC TOÀN ĐỘI ra Excel (.xlsx): bảng đầy đủ + tổng hợp theo người. */
export async function buildTeamTasksXlsx(): Promise<Buffer> {
  const tasks = await listAllTasksForExport();
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet("Phân công toàn đội");
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value = "BẢNG PHÂN CÔNG CÔNG VIỆC TOÀN ĐỘI KIỂM ĐỊNH";
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.columns = [
    { key: "stt", width: 6 }, { key: "assignee", width: 24 }, { key: "cycle", width: 24 },
    { key: "crit", width: 7 }, { key: "task", width: 42 }, { key: "deliverables", width: 44 },
    { key: "due", width: 12 }, { key: "prio", width: 12 }, { key: "status", width: 12 },
  ];
  const header = ws.addRow(["STT", "Người phụ trách", "Đợt kiểm định", "TC", "Công việc", "Minh chứng phải nộp", "Hạn", "Ưu tiên", "Trạng thái"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }; });
  tasks.forEach((t, i) => {
    ws.addRow([
      i + 1, t.assigneeName ?? UNASSIGNED, t.cycleName ?? "(ngoài đợt)", t.criterionCode ?? "—",
      t.title, t.deliverables ?? "", fmtDue(t.dueDate), PRIO_VI[t.priority] ?? t.priority, STATUS_VI[t.status] ?? t.status,
    ]);
  });
  ws.eachRow((row) => row.eachCell((c) => { c.alignment = { vertical: "top", wrapText: true }; }));

  const ws2 = wb.addWorksheet("Tổng hợp theo người");
  ws2.columns = [
    { header: "Người phụ trách", key: "name", width: 28 },
    { header: "Email", key: "email", width: 28 },
    { header: "Số việc", key: "count", width: 10 },
    { header: "Đã xong", key: "done", width: 10 },
    { header: "Ưu tiên cao", key: "high", width: 13 },
  ];
  ws2.getRow(1).font = { bold: true };
  const byName = new Map<string, { email: string; count: number; done: number; high: number }>();
  for (const t of tasks) {
    const k = t.assigneeName ?? UNASSIGNED;
    const e = byName.get(k) ?? { email: t.assigneeEmail ?? "", count: 0, done: 0, high: 0 };
    e.count++; if (t.status === "done") e.done++; if (t.priority === "high") e.high++;
    byName.set(k, e);
  }
  for (const [name, e] of byName) ws2.addRow({ name, email: e.email, count: e.count, done: e.done, high: e.high });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cell(text: string, bold = false, widthPct?: number) {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

/** Xuất CÔNG VIỆC TOÀN ĐỘI ra Word (.docx): nhóm theo từng NGƯỜI phụ trách. */
export async function buildTeamTasksDocx(): Promise<Buffer> {
  const tasks = await listAllTasksForExport();
  const groups = new Map<string, { email: string; items: typeof tasks }>();
  for (const t of tasks) {
    const key = t.assigneeName ?? UNASSIGNED;
    const g = groups.get(key) ?? { email: t.assigneeEmail ?? "", items: [] };
    g.items.push(t);
    groups.set(key, g);
  }

  const headers = ["Đợt", "TC", "Công việc", "Minh chứng phải nộp", "Hạn", "Trạng thái"];
  const widths = [18, 6, 26, 32, 9, 9];
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "PHÂN CÔNG CÔNG VIỆC TOÀN ĐỘI KIỂM ĐỊNH", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Tổng số công việc: ${tasks.length} · ${groups.size} người phụ trách`, italics: true })] }),
    new Paragraph({ text: "" }),
  ];
  for (const [name, g] of groups) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${name}${g.email ? ` (${g.email})` : ""} — ${g.items.length} việc` })] }));
    const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, true, widths[i])) });
    const rows = g.items.map((t) =>
      new TableRow({ children: [
        cell(t.cycleName ?? "(ngoài đợt)"),
        cell(t.criterionCode ?? "—"),
        cell(t.title),
        cell(t.deliverables ?? ""),
        cell(fmtDue(t.dueDate)),
        cell(STATUS_VI[t.status] ?? t.status),
      ] }),
    );
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] }));
    children.push(new Paragraph({ text: "" }));
  }
  if (tasks.length === 0) children.push(new Paragraph({ children: [new TextRun({ text: "Chưa có công việc nào.", italics: true })] }));

  const doc = new Document({ styles: { default: { document: { run: { size: 20 } } } }, sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
