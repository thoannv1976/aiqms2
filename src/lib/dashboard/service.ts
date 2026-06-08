import { prisma } from "@/lib/prisma/client";
import { getSar } from "@/lib/sar/service";

/** Dashboard cấp trường (đặc tả 4.1): tổng quan tiến độ kiểm định toàn tenant. */
export async function tenantDashboard() {
  const now = new Date();
  const [programmes, sars, sarByStatus, evidenceByStatus, tasksOverdue, openPlans] =
    await Promise.all([
      prisma.programme.count(),
      prisma.selfAssessmentReport.count(),
      prisma.selfAssessmentReport.groupBy({ by: ["status"], _count: true }),
      prisma.evidence.groupBy({ by: ["status"], _count: true }),
      prisma.task.count({ where: { dueDate: { lt: now }, status: { not: "done" } } }),
      prisma.improvementPlan.count({ where: { status: { in: ["open", "in_progress"] } } }),
    ]);

  return {
    programmes,
    sars,
    sarByStatus: Object.fromEntries(sarByStatus.map((s) => [s.status, s._count])),
    evidenceByStatus: Object.fromEntries(evidenceByStatus.map((e) => [e.status, e._count])),
    tasksOverdue,
    openImprovementPlans: openPlans,
  };
}

/** Dashboard cấp chương trình: trạng thái từng tiêu chí + điểm tự đánh giá TB. */
export async function programmeDashboard(sarId: string) {
  const sar = await getSar(sarId);
  const responses = sar.responses;
  const statusCount: Record<string, number> = {};
  let scoreSum = 0;
  let scored = 0;
  for (const r of responses) {
    statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
    if (typeof r.selfScore === "number") {
      scoreSum += r.selfScore;
      scored += 1;
    }
  }
  return {
    sarId,
    title: sar.title,
    status: sar.status,
    criteriaCount: responses.length,
    responseStatus: statusCount,
    averageSelfScore: scored ? Number((scoreSum / scored).toFixed(2)) : null,
    scoredCriteria: scored,
  };
}

/** Dashboard cá nhân: nhiệm vụ được giao + quá hạn. */
export async function personalDashboard(userId: string) {
  const now = new Date();
  const [byStatus, overdue, upcoming] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], where: { assigneeId: userId }, _count: true }),
    prisma.task.count({ where: { assigneeId: userId, dueDate: { lt: now }, status: { not: "done" } } }),
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: "done" } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);
  return {
    tasksByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    overdue,
    upcoming,
  };
}
