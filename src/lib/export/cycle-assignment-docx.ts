import { Document, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import { prisma } from "@/lib/prisma/client";
import { notFound } from "@/lib/http/responses";
import { listCycleTasks } from "@/lib/cycle-plan/service";

const STATUS_VI: Record<string, string> = { todo: "Cần làm", in_progress: "Đang làm", review: "Rà soát", done: "Hoàn thành" };

function cell(text: string, bold = false, widthPct?: number) {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

/** Xuất BẢNG PHÂN CÔNG của một đợt tự đánh giá ra Word (.docx). */
export async function buildCycleAssignmentDocx(cycleId: string): Promise<Buffer> {
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const programme = cycle.programmeId
    ? await prisma.programme.findFirst({ where: { id: cycle.programmeId }, select: { code: true, name: true } })
    : null;
  const tasks = await listCycleTasks(cycleId);

  const headers = ["STT", "Công việc", "TC", "Người phụ trách", "Minh chứng phải nộp", "Hạn", "Trạng thái"];
  const widths = [5, 30, 6, 18, 26, 8, 9];
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, true, widths[i])) });
  const rows = tasks.map((t, i) =>
    new TableRow({
      children: [
        cell(String(i + 1)),
        cell(t.title),
        cell(t.criterionCode ?? "—"),
        cell(t.assigneeName ?? "(chưa giao)"),
        cell(t.deliverables ?? ""),
        cell(t.dueDate ? new Date(t.dueDate).toLocaleDateString("vi-VN") : ""),
        cell(STATUS_VI[t.status] ?? t.status),
      ],
    }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { size: 20 } } } },
    sections: [{
      children: [
        new Paragraph({ text: "BẢNG PHÂN CÔNG CÔNG VIỆC KIỂM ĐỊNH", heading: HeadingLevel.TITLE }),
        new Paragraph({ children: [new TextRun({ text: `Đợt: ${cycle.name}${cycle.year ? ` (${cycle.year})` : ""}`, bold: true })] }),
        ...(programme ? [new Paragraph({ children: [new TextRun({ text: `Chương trình: ${programme.code} — ${programme.name}` })] })] : []),
        new Paragraph({ children: [new TextRun({ text: `Tổng số công việc: ${tasks.length}`, italics: true })] }),
        new Paragraph({ text: "" }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] }),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
