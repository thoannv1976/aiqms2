import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma/client";

const PHASE: Record<string, string> = { plan: "Plan", do: "Do", check: "Check", act: "Act" };

/** Xuất toàn bộ Kế hoạch cải tiến ra Excel (.xlsx): 1 sheet hành động + 1 sheet KPI. */
export async function buildImprovementXlsx(): Promise<Buffer> {
  const plans = await prisma.improvementPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { actions: { orderBy: { createdAt: "asc" } }, kpis: true },
  });

  const wb = new ExcelJS.Workbook();

  const wsA = wb.addWorksheet("Hành động");
  wsA.columns = [
    { header: "Kế hoạch", key: "plan", width: 32 },
    { header: "Trạng thái KH", key: "planStatus", width: 14 },
    { header: "Pha PDCA", key: "phase", width: 10 },
    { header: "Hành động", key: "action", width: 44 },
    { header: "Đơn vị phụ trách", key: "unit", width: 22 },
    { header: "Trạng thái", key: "status", width: 12 },
    { header: "Hạn", key: "due", width: 14 },
  ];
  wsA.getRow(1).font = { bold: true };
  for (const p of plans) {
    if (p.actions.length === 0) {
      wsA.addRow({ plan: p.title, planStatus: p.status });
      continue;
    }
    for (const a of p.actions) {
      wsA.addRow({
        plan: p.title,
        planStatus: p.status,
        phase: PHASE[a.pdcaPhase] ?? a.pdcaPhase,
        action: a.action,
        unit: a.responsibleUnit ?? "",
        status: a.status,
        due: a.dueDate ? new Date(a.dueDate).toLocaleDateString("vi-VN") : "",
      });
    }
  }

  const wsK = wb.addWorksheet("KPI");
  wsK.columns = [
    { header: "Kế hoạch", key: "plan", width: 32 },
    { header: "KPI", key: "name", width: 32 },
    { header: "Mục tiêu", key: "target", width: 12 },
    { header: "Thực tế", key: "actual", width: 12 },
    { header: "Đơn vị", key: "unit", width: 12 },
  ];
  wsK.getRow(1).font = { bold: true };
  for (const p of plans) {
    for (const k of p.kpis) {
      wsK.addRow({ plan: p.title, name: k.name, target: k.target ?? "", actual: k.actual ?? "", unit: k.unit ?? "" });
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
