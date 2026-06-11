import { prisma } from "@/lib/prisma/client";
import { notFound } from "@/lib/http/responses";
import { getSar } from "@/lib/sar/service";

/**
 * Bảng theo dõi tiến độ một ĐỢT tự đánh giá (D4).
 * Tổng hợp: % hoàn thiện theo từng tiêu chí (phân tích + điểm + minh chứng + yêu cầu con),
 * số minh chứng đã thu, tình hình nhiệm vụ (tổng/đã xong/quá hạn) và ai đang trễ hạn.
 */
export async function cycleProgress(cycleId: string) {
  const cycle = await prisma.assessmentCycle.findFirst({ where: { id: cycleId } });
  if (!cycle) throw notFound("Đợt tự đánh giá không tồn tại");
  const programme = cycle.programmeId
    ? await prisma.programme.findFirst({ where: { id: cycle.programmeId }, select: { id: true, code: true, name: true } })
    : null;

  // SAR mới nhất của đợt (kèm tiêu chí global qua getSar).
  const sarRow = await prisma.selfAssessmentReport.findFirst({
    where: { assessmentCycleId: cycleId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const sar = sarRow ? await getSar(sarRow.id) : null;

  // Tiến độ theo tiêu chí: 4 thành phần (phân tích 30 / điểm 20 / minh chứng 30 / yêu cầu 20).
  const criteria: {
    criterionId: string; code: string; titleVi: string; completionPercent: number;
    hasAnalysis: boolean; hasScore: boolean; evidenceCount: number;
    requirementsAssessed: number; requirementsTotal: number;
  }[] = [];

  if (sar) {
    const reqResponses = await prisma.sarRequirementResponse.findMany({ where: { sarId: sar.id } });
    const assessedReqByCrit = new Map<string, number>();
    const reqByCrit = await prisma.requirement.groupBy({
      by: ["criterionId"],
      where: { criterionId: { in: sar.responses.map((r) => r.criterionId) } },
      _count: { _all: true },
    });
    const totalReqByCrit = new Map(reqByCrit.map((r) => [r.criterionId, r._count._all]));
    // Cần map từng requirementResponse về criterion của nó.
    if (reqResponses.length) {
      const reqs = await prisma.requirement.findMany({
        where: { id: { in: reqResponses.map((r) => r.requirementId) } },
        select: { id: true, criterionId: true },
      });
      const critByReq = new Map(reqs.map((q) => [q.id, q.criterionId]));
      for (const rr of reqResponses) {
        if (rr.status === "not_assessed") continue;
        const cId = critByReq.get(rr.requirementId);
        if (cId) assessedReqByCrit.set(cId, (assessedReqByCrit.get(cId) ?? 0) + 1);
      }
    }

    for (const r of sar.responses) {
      const evidenceCount = await prisma.evidenceCriterionMapping.count({ where: { criterionId: r.criterionId } });
      const hasAnalysis = !!r.analysis?.trim();
      const hasScore = r.selfScore != null;
      const reqTotal = totalReqByCrit.get(r.criterionId) ?? 0;
      const reqAssessed = assessedReqByCrit.get(r.criterionId) ?? 0;
      let pct = 0;
      if (hasAnalysis) pct += 30;
      if (hasScore) pct += 20;
      if (evidenceCount > 0) pct += 30;
      pct += reqTotal > 0 ? Math.round((reqAssessed / reqTotal) * 20) : 20;
      criteria.push({
        criterionId: r.criterionId,
        code: r.criterion?.code ?? "",
        titleVi: r.criterion?.titleVi ?? "",
        completionPercent: pct,
        hasAnalysis, hasScore, evidenceCount,
        requirementsAssessed: reqAssessed, requirementsTotal: reqTotal,
      });
    }
  }
  const overallPercent = criteria.length
    ? Math.round(criteria.reduce((a, c) => a + c.completionPercent, 0) / criteria.length)
    : 0;

  const evidenceTotal = await prisma.evidence.count({ where: { deletedAt: null } });

  // Nhiệm vụ của đợt.
  const tasks = await prisma.task.findMany({ where: { cycleId, deletedAt: null } });
  const now = new Date();
  const isOverdue = (t: { status: string; dueDate: Date | null }) =>
    t.status !== "done" && !!t.dueDate && t.dueDate < now;
  const taskStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter(isOverdue).length,
  };

  // Ai đang trễ hạn (gộp theo người phụ trách).
  const overdueByAssignee = new Map<string, number>();
  for (const t of tasks) if (isOverdue(t) && t.assigneeId) overdueByAssignee.set(t.assigneeId, (overdueByAssignee.get(t.assigneeId) ?? 0) + 1);
  const assigneeIds = [...overdueByAssignee.keys()];
  const users = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const behind = assigneeIds
    .map((id) => ({ assigneeId: id, assigneeName: nameById.get(id) ?? id, overdue: overdueByAssignee.get(id) ?? 0 }))
    .sort((a, b) => b.overdue - a.overdue);

  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status, programme },
    sar: sar ? { id: sar.id, title: sar.title } : null,
    criteria,
    overallPercent,
    evidenceTotal,
    tasks: taskStats,
    behind,
  };
}
