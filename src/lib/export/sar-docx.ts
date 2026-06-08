import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { getSar } from "@/lib/sar/service";

/** Xuất SAR ra Word (.docx): thông tin chung + phân tích từng tiêu chí. */
export async function buildSarDocx(sarId: string): Promise<Buffer> {
  const sar = await getSar(sarId);

  const children: Paragraph[] = [
    new Paragraph({ text: sar.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: `Trạng thái: ${sar.status}`, italics: true })],
    }),
    new Paragraph({ text: "Phân tích theo tiêu chí", heading: HeadingLevel.HEADING_1 }),
  ];

  for (const r of sar.responses) {
    const title = r.criterion
      ? `${r.criterion.code}. ${r.criterion.titleVi}`
      : "(Tiêu chí)";
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
    const fields: [string, string | null | undefined][] = [
      ["Mô tả hiện trạng", r.currentState],
      ["Phân tích mức độ đáp ứng", r.analysis],
      ["Điểm mạnh", r.strengths],
      ["Điểm tồn tại", r.weaknesses],
      ["Hoạt động cải tiến đã thực hiện", r.improvementDone],
      ["Kế hoạch cải tiến", r.improvementPlan],
    ];
    for (const [label, value] of fields) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true }),
            new TextRun({ text: value || "—" }),
          ],
        }),
      );
    }
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Điểm tự đánh giá: ", bold: true }),
          new TextRun({ text: r.selfScore != null ? String(r.selfScore) : "—" }),
        ],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
