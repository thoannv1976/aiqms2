import ExcelJS from "exceljs";
import { Document, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { listMyTasks } from "@/lib/tasks/service";

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };
const PRIO_VI: Record<string, string> = { low: "Thấp", normal: "Bình thường", high: "Cao" };

async function myName(): Promise<string> {
  const ctx = requireTenantContext();
  if (!ctx.actorId) return "Người dùng";
  const u = await prisma.user.findFirst({ where: { id: ctx.actorId }, select: { fullName: true, email: true } });
  return u?.fullName ?? u?.email ?? "Người dùng";
}

const fmtDue = (d: Date | null) => (d ? new Date(d).toLocaleDateString("vi-VN") : "");

/** Xuất CÔNG VIỆC CỦA TÔI ra Excel (.xlsx) — đầy đủ đợt/tiêu chí/minh chứng phải nộp. */
export async function buildMyTasksXlsx(): Promise<Buffer> {
  const name = await myName();
  const tasks = await listMyTasks();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Công việc của tôi");
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `CÔNG VIỆC ĐƯỢC PHÂN CÔNG — ${name}`;
  ws.getCell("A1").font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.columns = [
    { key: "stt", width: 6 }, { key: "cycle", width: 26 }, { key: "crit", width: 8 },
    { key: "task", width: 44 }, { key: "deliverables", width: 46 },
    { key: "due", width: 13 }, { key: "prio", width: 13 }, { key: "status", width: 13 },
  ];
  const header = ws.addRow(["STT", "Đợt kiểm định", "Tiêu chí", "Công việc", "Minh chứng phải nộp", "Hạn", "Ưu tiên", "Trạng thái"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }; });
  tasks.forEach((t, i) => {
    ws.addRow([
      i + 1, t.cycleName ?? "(ngoài đợt)", t.criterionCode ?? "—", t.title,
      t.deliverables ?? "", fmtDue(t.dueDate), PRIO_VI[t.priority] ?? t.priority, STATUS_VI[t.status] ?? t.status,
    ]);
  });
  ws.eachRow((row) => row.eachCell((c) => { c.alignment = { vertical: "top", wrapText: true }; }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cell(text: string, bold = false, widthPct?: number) {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

/** Xuất CÔNG VIỆC CỦA TÔI ra Word (.docx) — nhóm theo từng ĐỢT kiểm định. */
export async function buildMyTasksDocx(): Promise<Buffer> {
  const name = await myName();
  const tasks = await listMyTasks();

  // Nhóm theo đợt.
  const groups = new Map<string, { name: string; items: typeof tasks }>();
  for (const t of tasks) {
    const key = t.cycleId ?? "__none__";
    const g = groups.get(key) ?? { name: t.cycleName ?? "Nhiệm vụ khác (ngoài đợt)", items: [] };
    g.items.push(t);
    groups.set(key, g);
  }

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "CÔNG VIỆC ĐƯỢC PHÂN CÔNG", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Người phụ trách: ${name}`, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Tổng số công việc: ${tasks.length}`, italics: true })] }),
    new Paragraph({ text: "" }),
  ];
  const headers = ["TC", "Công việc", "Minh chứng phải nộp", "Hạn", "Trạng thái"];
  const widths = [7, 33, 38, 10, 12];
  for (const g of groups.values()) {
    children.push(new Paragraph({ text: g.name, heading: HeadingLevel.HEADING_2 }));
    const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, true, widths[i])) });
    const rows = g.items.map((t) =>
      new TableRow({ children: [
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
  if (tasks.length === 0) children.push(new Paragraph({ children: [new TextRun({ text: "Chưa được giao công việc nào.", italics: true })] }));

  const doc = new Document({ styles: { default: { document: { run: { size: 20 } } } }, sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
