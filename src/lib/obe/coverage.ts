import { prisma } from "@/lib/prisma/client";
import { notFound } from "@/lib/http/responses";

export type CoverageSeverity = "warning" | "info";
export interface CoverageWarning {
  type: string;
  severity: CoverageSeverity;
  message: string;
  refId?: string;
}

/**
 * Cảnh báo độ phủ OBE (đặc tả 4.6): phát hiện liên kết thiếu giữa PLO/CLO/học phần.
 * Tính trực tiếp từ dữ liệu (không lưu) để luôn cập nhật.
 */
export async function coverageWarnings(programmeVersionId: string): Promise<CoverageWarning[]> {
  const version = await prisma.programmeVersion.findFirst({
    where: { id: programmeVersionId },
  });
  if (!version) throw notFound("Phiên bản CTĐT không tồn tại");

  const plos = await prisma.programmeLearningOutcome.findMany({
    where: { programmeVersionId },
    include: {
      courseMappings: true,
      cloMappings: true,
    },
  });

  const warnings: CoverageWarning[] = [];

  // PLO chưa được học phần nào hỗ trợ.
  for (const plo of plos) {
    if (plo.courseMappings.length === 0) {
      warnings.push({
        type: "plo_no_course",
        severity: "warning",
        message: `${plo.code} chưa được học phần nào hỗ trợ`,
        refId: plo.id,
      });
    }
    // PLO có quá ít minh chứng đo lường (chưa có CLO liên kết).
    if (plo.cloMappings.length === 0) {
      warnings.push({
        type: "plo_no_clo",
        severity: "warning",
        message: `${plo.code} chưa có CLO nào liên kết để đo lường`,
        refId: plo.id,
      });
    }
  }

  // CLO không liên kết với PLO nào (trong toàn tenant — phạm vi đã lọc theo tenant).
  const orphanClos = await prisma.courseLearningOutcome.findMany({
    where: { ploMappings: { none: {} } },
    include: { course: { select: { code: true } } },
  });
  for (const clo of orphanClos) {
    warnings.push({
      type: "clo_no_plo",
      severity: "info",
      message: `${clo.course.code}/${clo.code} chưa liên kết với PLO nào`,
      refId: clo.id,
    });
  }

  return warnings;
}
