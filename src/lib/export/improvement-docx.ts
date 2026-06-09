import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { getPlan } from "@/lib/improvement/service";

const PHASE: Record<string, string> = { plan: "Plan", do: "Do", check: "Check", act: "Act" };

/** Xuất một Kế hoạch cải tiến (PDCA) ra Word (.docx): vấn đề/nguyên nhân + hành động + KPI. */
export async function buildImprovementDocx(planId: string): Promise<Buffer> {
  const plan = await getPlan(planId);

  const children: Paragraph[] = [
    new Paragraph({ text: plan.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Trạng thái: ${plan.status}`, italics: true })] }),
  ];

  if (plan.issue) {
    children.push(new Paragraph({ text: "Vấn đề", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: plan.issue }));
  }
  if (plan.cause) {
    children.push(new Paragraph({ text: "Nguyên nhân", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: plan.cause }));
  }

  children.push(new Paragraph({ text: "Hành động cải tiến (PDCA)", heading: HeadingLevel.HEADING_1 }));
  if (plan.actions.length === 0) {
    children.push(new Paragraph({ text: "— Chưa có hành động —" }));
  }
  for (const a of plan.actions) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `[${PHASE[a.pdcaPhase] ?? a.pdcaPhase}] `, bold: true }),
          new TextRun({ text: a.action }),
        ],
      }),
    );
    const meta: string[] = [];
    if (a.responsibleUnit) meta.push(`Đơn vị: ${a.responsibleUnit}`);
    meta.push(`Trạng thái: ${a.status}`);
    if (a.dueDate) meta.push(`Hạn: ${new Date(a.dueDate).toLocaleDateString("vi-VN")}`);
    children.push(new Paragraph({ children: [new TextRun({ text: meta.join("  •  "), italics: true, size: 18 })] }));
    for (const p of a.progress) {
      children.push(new Paragraph({ text: `   - ${p.note}${p.percent != null ? ` (${p.percent}%)` : ""}` }));
    }
  }

  children.push(new Paragraph({ text: "KPI đo lường", heading: HeadingLevel.HEADING_1 }));
  if (plan.kpis.length === 0) {
    children.push(new Paragraph({ text: "— Chưa có KPI —" }));
  }
  for (const k of plan.kpis) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${k.name}: `, bold: true }),
          new TextRun({ text: `${k.actual ?? "—"}/${k.target ?? "—"} ${k.unit ?? ""}` }),
        ],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
