import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { getStorage, tenantKey } from "@/lib/storage";
import { env } from "@/config/env";
import { badRequest, notFound } from "@/lib/http/responses";
import { buildSarDocx } from "./sar-docx";
import { buildSarPdf } from "./sar-pdf";
import { buildEvidenceXlsx } from "./evidence-xlsx";
import { buildEvidenceZip } from "./evidence-zip";

export const EXPORT_TYPES = ["sar_docx", "sar_pdf", "evidence_xlsx", "evidence_zip"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const createExportSchema = z.object({
  type: z.enum(EXPORT_TYPES),
  sarId: z.string().optional(),
  criterionId: z.string().optional(),
});

type Params = z.infer<typeof createExportSchema>;

const MIME: Record<ExportType, { ext: string; contentType: string }> = {
  sar_docx: { ext: "docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  sar_pdf: { ext: "pdf", contentType: "application/pdf" },
  evidence_xlsx: { ext: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  evidence_zip: { ext: "zip", contentType: "application/zip" },
};

async function runExporter(type: ExportType, params: Params): Promise<Buffer> {
  switch (type) {
    case "sar_docx":
      if (!params.sarId) throw badRequest("sar_docx cần sarId");
      return buildSarDocx(params.sarId);
    case "sar_pdf":
      if (!params.sarId) throw badRequest("sar_pdf cần sarId");
      return buildSarPdf(params.sarId);
    case "evidence_xlsx":
      return buildEvidenceXlsx();
    case "evidence_zip":
      return buildEvidenceZip(params.criterionId);
  }
}

/**
 * Tạo job xuất báo cáo. Tác vụ nặng -> job có polling tiến độ.
 * JOB_MODE=inline (dev): chạy ngay. JOB_MODE=queue: cũng xử lý trong tiến trình
 * (đặt chỗ cho BullMQ khi có Redis) — interface không đổi.
 */
export async function createExportJob(params: Params) {
  const ctx = requireTenantContext();
  const job = await prisma.exportJob.create({
    data: withTenantId({ type: params.type, params, createdBy: ctx.actorId }),
  });
  await writeAudit({ action: "export.create", entity: "ExportJob", entityId: job.id, meta: { type: params.type } });

  // Xử lý (inline). Lỗi được ghi vào job, không ném ra để client vẫn poll được.
  await processJob(job.id, params);
  return prisma.exportJob.findFirstOrThrow({ where: { id: job.id } });
}

async function processJob(jobId: string, params: Params) {
  const ctx = requireTenantContext();
  try {
    await prisma.exportJob.update({ where: { id: jobId }, data: { status: "running", progress: 10 } });
    const buffer = await runExporter(params.type, params);
    const { ext, contentType } = MIME[params.type];
    const fileName = `${params.type}-${jobId}.${ext}`;
    const key = tenantKey(ctx.tenantId, "exports", fileName);
    await getStorage().put(key, buffer, { contentType });
    await prisma.exportJob.update({
      where: { id: jobId },
      data: { status: "done", progress: 100, resultKey: key, fileName },
    });
  } catch (e) {
    console.error(`[EXPORT] job ${jobId} failed`, e);
    await prisma.exportJob.update({
      where: { id: jobId },
      data: { status: "failed", error: e instanceof Error ? e.message : String(e) },
    });
  }
  void env; // cờ JOB_MODE dành cho nhánh queue tương lai
}

export async function getJob(id: string) {
  const job = await prisma.exportJob.findFirst({ where: { id } });
  if (!job) throw notFound("Job không tồn tại");
  return job;
}

export async function downloadJob(id: string) {
  const job = await getJob(id);
  if (job.status !== "done" || !job.resultKey) {
    throw badRequest("Job chưa hoàn thành", "job_not_ready");
  }
  const body = await getStorage().get(job.resultKey);
  if (!body) throw notFound("File kết quả không tồn tại");
  const contentType = MIME[job.type as ExportType]?.contentType ?? "application/octet-stream";
  return { body, fileName: job.fileName ?? "export", contentType };
}
