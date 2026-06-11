import { prisma } from "@/lib/prisma/client";

const CAT_VI: Record<string, string> = {
  graduation: "Tốt nghiệp", employment: "Việc làm", satisfaction: "Hài lòng",
  plo_attainment: "Đạt PLO", research: "Nghiên cứu", other: "Khác",
};

export interface BenchmarkRow {
  id: string; name: string; category: string; categoryLabel: string;
  academicYear: string | null; value: number | null; unit: string | null;
  target: number | null; benchmark: number | null;
  gapToTarget: number | null; gapToBenchmark: number | null;
  status: "above" | "on_par" | "below" | "unknown";
}

/**
 * Báo cáo đối sánh (benchmarking) — D9: so sánh giá trị chỉ số C8 với mốc đối sánh (CT tham
 * chiếu) và chỉ tiêu. Tính khoảng cách + xếp trạng thái để biết chỗ nào cần cải thiện.
 */
export async function benchmarkReport() {
  const metrics = await prisma.outcomeMetric.findMany({
    where: { deletedAt: null },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const rows: BenchmarkRow[] = metrics.map((m) => {
    const gapToTarget = m.value != null && m.target != null ? Math.round((m.value - m.target) * 100) / 100 : null;
    const gapToBenchmark = m.value != null && m.benchmark != null ? Math.round((m.value - m.benchmark) * 100) / 100 : null;
    // Xếp trạng thái ưu tiên theo mốc đối sánh, nếu không có thì theo chỉ tiêu.
    const ref = gapToBenchmark ?? gapToTarget;
    const status: BenchmarkRow["status"] =
      ref == null ? "unknown" : ref >= 0.01 ? "above" : ref <= -0.01 ? "below" : "on_par";
    return {
      id: m.id, name: m.name, category: m.category, categoryLabel: CAT_VI[m.category] ?? m.category,
      academicYear: m.academicYear, value: m.value, unit: m.unit,
      target: m.target, benchmark: m.benchmark, gapToTarget, gapToBenchmark, status,
    };
  });

  const withBenchmark = rows.filter((r) => r.benchmark != null);
  const summary = {
    total: rows.length,
    benchmarked: withBenchmark.length,
    above: rows.filter((r) => r.status === "above").length,
    below: rows.filter((r) => r.status === "below").length,
    onPar: rows.filter((r) => r.status === "on_par").length,
  };
  return { summary, rows };
}
