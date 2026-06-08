import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSar } from "@/lib/sar/service";

/**
 * Xuất SAR ra PDF tóm tắt (pdf-lib — thuần JS, không cần trình duyệt).
 * Bản đầy đủ có thể render từ Word/HTML qua Playwright ở môi trường có browser.
 */
export async function buildSarPdf(sarId: string): Promise<Buffer> {
  const sar = await getSar(sarId);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage();
  let { height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const write = (text: string, size = 11, f = font) => {
    if (y < margin) {
      page = pdf.addPage();
      height = page.getSize().height;
      y = height - margin;
    }
    // pdf-lib StandardFonts không hỗ trợ Unicode tiếng Việt đầy đủ -> bỏ dấu an toàn.
    const safe = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    page.drawText(safe.slice(0, 110), { x: margin, y, size, font: f, color: rgb(0, 0, 0) });
    y -= size + 6;
  };

  write(sar.title, 18, bold);
  write(`Trang thai: ${sar.status}`, 10);
  y -= 6;

  for (const r of sar.responses) {
    write(r.criterion ? `${r.criterion.code}. ${r.criterion.titleVi}` : "(Tieu chi)", 13, bold);
    write(`Diem tu danh gia: ${r.selfScore ?? "-"}`, 10);
    if (r.strengths) write(`Diem manh: ${r.strengths}`, 10);
    if (r.weaknesses) write(`Diem ton tai: ${r.weaknesses}`, 10);
    y -= 4;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
