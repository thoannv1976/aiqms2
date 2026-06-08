import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma/client";

/** Xuất danh mục minh chứng ra Excel (.xlsx). */
export async function buildEvidenceXlsx(): Promise<Buffer> {
  const evidences = await prisma.evidence.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { files: true, criteria: true } } },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Minh chứng");
  ws.columns = [
    { header: "Mã", key: "code", width: 12 },
    { header: "Tên minh chứng", key: "title", width: 40 },
    { header: "Loại", key: "type", width: 18 },
    { header: "Đơn vị cung cấp", key: "providerUnit", width: 24 },
    { header: "Năm học", key: "academicYear", width: 12 },
    { header: "Trạng thái", key: "status", width: 14 },
    { header: "Số file", key: "files", width: 8 },
    { header: "Số tiêu chí", key: "criteria", width: 10 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const e of evidences) {
    ws.addRow({
      code: e.code,
      title: e.title,
      type: e.type ?? "",
      providerUnit: e.providerUnit ?? "",
      academicYear: e.academicYear ?? "",
      status: e.status,
      files: e._count.files,
      criteria: e._count.criteria,
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
