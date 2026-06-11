import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createTenantFixture, seedRbac } from "../helpers/fixtures";
import { seedAunqa } from "@/lib/standards/seed";
import { runWithTenant } from "@/lib/tenant/context";
import { boardView, createTask, updateTask } from "@/lib/tasks/service";
import { addAction, addKpi, createPlan, createPlansFromSarWeaknesses, getPlan, logProgress } from "@/lib/improvement/service";
import { personalDashboard, programmeDashboard, tenantDashboard } from "@/lib/dashboard/service";
import { createProgramme } from "@/lib/programmes/service";
import { createCycle, createSar, getSar, updateCriterionResponse } from "@/lib/sar/service";

let aunVersionId: string;
const asTenant = <T>(tenantId: string, actorId: string, fn: () => Promise<T>) =>
  runWithTenant({ tenantId, actorId }, fn);

describe("P6 — Nhiệm vụ + Cải tiến PDCA + Dashboard", () => {
  beforeAll(async () => {
    await seedRbac();
    await seedAunqa(prisma);
    aunVersionId = (await prisma.standardVersion.findFirstOrThrow({ where: { version: "4.0" } })).id;
  });
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("Kanban board nhóm nhiệm vụ theo cột trạng thái", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, "u1", async () => {
      const a = await createTask({ title: "Thu thập MC", priority: "high" });
      await createTask({ title: "Viết SAR", priority: "normal" });
      await updateTask(a.id, { status: "in_progress" });
      const board = await boardView();
      const todo = board.find((c) => c.status === "todo")!;
      const inProgress = board.find((c) => c.status === "in_progress")!;
      expect(todo.tasks).toHaveLength(1);
      expect(inProgress.tasks).toHaveLength(1);
    });
  });

  it("PDCA: kế hoạch + hành động + KPI + log tiến độ cập nhật trạng thái", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, "u1", async () => {
      const plan = await createPlan({ title: "Cải tiến rubric", issue: "Thiếu rubric" });
      const action = await addAction(plan.id, { action: "Xây rubric mẫu", pdcaPhase: "plan" });
      await addKpi(plan.id, { name: "Số học phần có rubric", unit: "học phần", target: 10 });
      await logProgress(action.id, "Hoàn thành", 100);

      const full = await getPlan(plan.id);
      expect(full.actions[0].status).toBe("done");
      expect(full.kpis).toHaveLength(1);
      expect(full.actions[0].progress).toHaveLength(1);
    });
  });

  it("tạo kế hoạch cải tiến từ điểm tồn tại của SAR (C3/D6), idempotent", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, "u1", async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId });
      const sar = await createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR" });
      const detail = await getSar(sar.id);
      await updateCriterionResponse(detail.responses[0].id, { weaknesses: "Thiếu rà soát PLO định kỳ" });

      const res = await createPlansFromSarWeaknesses(sar.id);
      // 8 tiêu chí đều có khoảng trống (chưa MC/phân tích/điểm) → 8 kế hoạch.
      expect(res.createdCount).toBe(8);
      const first = await getPlan(res.created[0].id);
      expect(first.issue).toContain("Thiếu rà soát PLO");

      // Chạy lại không tạo trùng.
      const again = await createPlansFromSarWeaknesses(sar.id);
      expect(again.createdCount).toBe(0);
    });
  });

  it("dashboard cấp trường tổng hợp số liệu", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, "u1", async () => {
      await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      await createTask({ title: "Quá hạn", priority: "normal", dueDate: new Date(Date.now() - 86400000) });
      const dash = await tenantDashboard();
      expect(dash.programmes).toBe(1);
      expect(dash.tasksOverdue).toBe(1);
    });
  });

  it("dashboard cấp chương trình: điểm tự đánh giá trung bình", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, "u1", async () => {
      const prog = await createProgramme({ code: "IT", name: "CNTT", level: "bachelor", initialVersion: "2024" });
      const cycle = await createCycle({ name: "2024", standardVersionId: aunVersionId });
      const sar = await createSar({ assessmentCycleId: cycle.id, programmeVersionId: prog.versions[0].id, title: "SAR" });
      const detail = await getSar(sar.id);
      await updateCriterionResponse(detail.responses[0].id, { selfScore: 4 });
      await updateCriterionResponse(detail.responses[1].id, { selfScore: 6 });

      const dash = await programmeDashboard(sar.id);
      expect(dash.criteriaCount).toBe(8);
      expect(dash.averageSelfScore).toBe(5);
      expect(dash.scoredCriteria).toBe(2);
    });
  });

  it("dashboard cá nhân: nhiệm vụ được giao + quá hạn", async () => {
    const t = await createTenantFixture("demo");
    await asTenant(t.id, "u1", async () => {
      await createTask({ title: "Của tôi", priority: "normal", assigneeId: "me", dueDate: new Date(Date.now() - 1000) });
      await createTask({ title: "Người khác", priority: "normal", assigneeId: "other" });
      const dash = await personalDashboard("me");
      expect(dash.overdue).toBe(1);
      expect(dash.upcoming).toHaveLength(1);
    });
  });

  it("cách ly tenant: nhiệm vụ trường A không lọt sang B", async () => {
    const a = await createTenantFixture("a");
    const b = await createTenantFixture("b");
    await asTenant(a.id, "u", () => createTask({ title: "A-task", priority: "normal" }));
    const inB = await asTenant(b.id, "u", () => prisma.task.findMany());
    expect(inB).toHaveLength(0);
  });
});
