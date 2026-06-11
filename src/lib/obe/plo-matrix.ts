import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { badRequest } from "@/lib/http/responses";

// ─── Các ma trận PLO tổng quát (ngoài PLO–Học phần & CLO–PLO đã có riêng) ────
export const PLO_DIMENSIONS = ["peo", "teaching", "assessment", "measurement"] as const;
export type PloDimension = (typeof PLO_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<PloDimension, string> = {
  peo: "PEO – PLO (mục tiêu ↔ chuẩn đầu ra)",
  teaching: "PLO – Phương pháp dạy học (C3)",
  assessment: "PLO – Phương pháp đánh giá (C4)",
  measurement: "PLO – Minh chứng đo lường (C8)",
};

/** Danh mục cột cố định (data-driven) cho từng chiều; PEO lấy động từ CTĐT. */
const TEACHING_COLS = [
  ["lecture", "Lecture"], ["case_study", "Case study"], ["project", "Project-based"],
  ["lab", "Lab/Thực hành"], ["internship", "Internship"], ["thesis", "Thesis/Capstone"],
  ["discussion", "Thảo luận"], ["flipped", "Flipped/Blended"],
] as const;
const ASSESSMENT_COLS = [
  ["quiz", "Quiz"], ["assignment", "Assignment"], ["presentation", "Presentation"],
  ["project", "Project"], ["exam", "Exam"], ["internship_report", "Internship report"],
  ["thesis", "Thesis/Capstone"], ["rubric", "Rubric"],
] as const;
const MEASUREMENT_COLS = [
  ["direct", "Minh chứng trực tiếp"], ["indirect", "Minh chứng gián tiếp"],
  ["cycle", "Chu kỳ đo"], ["unit", "Đơn vị phụ trách"],
] as const;

/** Chiều measurement nhập văn bản tự do; các chiều còn lại là ô tích "x". */
export const isTextDimension = (d: string) => d === "measurement";

async function columnsFor(dimension: PloDimension, programmeVersionId: string): Promise<{ key: string; label: string }[]> {
  if (dimension === "peo") {
    const peos = await prisma.programmeObjective.findMany({ where: { programmeVersionId }, orderBy: { order: "asc" } });
    return peos.map((p) => ({ key: p.code, label: p.code }));
  }
  const table = dimension === "teaching" ? TEACHING_COLS : dimension === "assessment" ? ASSESSMENT_COLS : MEASUREMENT_COLS;
  return table.map(([key, label]) => ({ key, label }));
}

/** Trả về ma trận PLO × cột cho một chiều: hàng PLO, danh mục cột, các ô đã có. */
export async function ploMatrix(programmeVersionId: string, dimension: PloDimension) {
  const [plos, columns, cells] = await Promise.all([
    prisma.programmeLearningOutcome.findMany({ where: { programmeVersionId }, orderBy: { order: "asc" } }),
    columnsFor(dimension, programmeVersionId),
    prisma.ploMatrixCell.findMany({ where: { programmeVersionId, dimension } }),
  ]);
  return {
    dimension,
    label: DIMENSION_LABELS[dimension],
    textMode: isTextDimension(dimension),
    plos: plos.map((p) => ({ id: p.id, code: p.code, description: p.description })),
    columns,
    cells: cells.map((c) => ({ ploId: c.ploId, colKey: c.colKey, value: c.value })),
  };
}

export const setCellSchema = z.object({
  programmeVersionId: z.string().min(1),
  ploId: z.string().min(1),
  dimension: z.enum(PLO_DIMENSIONS),
  colKey: z.string().min(1),
  value: z.string(), // "" -> xóa ô
});

/** Đặt/xóa một ô ma trận (value rỗng -> xóa). */
export async function setPloMatrixCell(input: z.infer<typeof setCellSchema>) {
  const ctx = requireTenantContext();
  const plo = await prisma.programmeLearningOutcome.findFirst({ where: { id: input.ploId, programmeVersionId: input.programmeVersionId } });
  if (!plo) throw badRequest("PLO không thuộc phiên bản CTĐT này");
  const where = {
    programmeVersionId_ploId_dimension_colKey: {
      programmeVersionId: input.programmeVersionId, ploId: input.ploId, dimension: input.dimension, colKey: input.colKey,
    },
  };
  if (!input.value.trim()) {
    await prisma.ploMatrixCell.deleteMany({ where: { programmeVersionId: input.programmeVersionId, ploId: input.ploId, dimension: input.dimension, colKey: input.colKey } });
    await writeAudit({ action: "matrix.plo_cell.clear", entity: "PloMatrixCell", meta: { dimension: input.dimension } });
    return { cleared: true };
  }
  const cell = await prisma.ploMatrixCell.upsert({
    where,
    update: { value: input.value, updatedBy: ctx.actorId },
    create: withTenantId({ programmeVersionId: input.programmeVersionId, ploId: input.ploId, dimension: input.dimension, colKey: input.colKey, value: input.value, createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "matrix.plo_cell.set", entity: "PloMatrixCell", entityId: cell.id, meta: { dimension: input.dimension } });
  return cell;
}

export const matrixCellsDraftSchema = z.object({
  cells: z.array(z.object({ ploCode: z.string(), colKey: z.string(), value: z.string().optional() })).default([]),
});
export type MatrixCellsDraft = z.infer<typeof matrixCellsDraftSchema>;

/** Ghi hàng loạt ô do AI đề xuất (theo mã PLO + khóa cột) cho một chiều. */
export async function applyPloMatrixCells(programmeVersionId: string, dimension: PloDimension, input: MatrixCellsDraft) {
  const ctx = requireTenantContext();
  const data = matrixCellsDraftSchema.parse(input);
  const validCols = new Set((await columnsFor(dimension, programmeVersionId)).map((c) => c.key.toLowerCase()));
  const ploByCode = new Map(
    (await prisma.programmeLearningOutcome.findMany({ where: { programmeVersionId } })).map((p) => [p.code.toUpperCase(), p.id]),
  );
  let applied = 0;
  const errors: string[] = [];
  for (const c of data.cells) {
    const ploId = ploByCode.get((c.ploCode ?? "").trim().toUpperCase());
    const colKey = (c.colKey ?? "").trim().toLowerCase();
    const value = (c.value ?? "x").trim() || "x";
    if (!ploId) { errors.push(`Bỏ qua: không có ${c.ploCode}`); continue; }
    if (!validCols.has(colKey)) { errors.push(`Bỏ qua cột lạ: ${c.colKey}`); continue; }
    await prisma.ploMatrixCell.upsert({
      where: { programmeVersionId_ploId_dimension_colKey: { programmeVersionId, ploId, dimension, colKey } },
      update: { value, updatedBy: ctx.actorId },
      create: withTenantId({ programmeVersionId, ploId, dimension, colKey, value, createdBy: ctx.actorId }),
    });
    applied++;
  }
  await writeAudit({ action: "matrix.plo_cells.apply", entity: "PloMatrixCell", meta: { dimension, applied } });
  return { applied, errors };
}
