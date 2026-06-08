import JSZip from "jszip";
import { prisma } from "@/lib/prisma/client";
import { getStorage } from "@/lib/storage";

/**
 * Gói minh chứng thành .zip theo cấu trúc tiêu chí (đặc tả 4.4).
 * Nếu truyền criterionId, chỉ gói minh chứng của tiêu chí đó.
 */
export async function buildEvidenceZip(criterionId?: string): Promise<Buffer> {
  const zip = new JSZip();
  const storage = getStorage();

  const evidences = await prisma.evidence.findMany({
    where: criterionId ? { criteria: { some: { criterionId } } } : {},
    include: { files: true, criteria: true },
    orderBy: { code: "asc" },
  });

  for (const ev of evidences) {
    // Thư mục theo tiêu chí đầu tiên (hoặc "chung").
    const folder = ev.criteria[0]?.criterionId
      ? `tieu-chi/${ev.criteria[0].criterionId}`
      : "chung";
    for (const f of ev.files) {
      const body = await storage.get(f.storageKey);
      if (body) {
        zip.file(`${folder}/${ev.code}-${f.fileName}`, body);
      }
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
