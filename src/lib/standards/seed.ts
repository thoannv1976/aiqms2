import { AUNQA } from "./aunqa-data";
import type { StandardDataset } from "./dataset";

/**
 * Seed một bộ tiêu chuẩn từ dữ liệu (data-driven — thêm chuẩn mới = nạp dữ liệu,
 * KHÔNG sửa code lõi). Idempotent. Nhận client Prisma (base/extended) — model bộ
 * tiêu chuẩn là GLOBAL nên không cần tenant context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedStandard(db: any, dataset: StandardDataset) {
  const standard = await db.accreditationStandard.upsert({
    where: { code: dataset.standard.code },
    update: { name: dataset.standard.name, description: dataset.standard.description },
    create: dataset.standard,
  });

  const version = await db.standardVersion.upsert({
    where: { standardId_version: { standardId: standard.id, version: dataset.version.version } },
    update: { name: dataset.version.name, isActive: dataset.version.isActive },
    create: { standardId: standard.id, ...dataset.version },
  });

  // Thang đánh giá.
  for (const s of dataset.ratingScale) {
    await db.ratingScale.upsert({
      where: { standardVersionId_level: { standardVersionId: version.id, level: s.level } },
      update: { labelEn: s.labelEn, labelVi: s.labelVi },
      create: { standardVersionId: version.id, ...s },
    });
  }

  // Tiêu chí + yêu cầu + minh chứng gợi ý.
  for (const c of dataset.criteria) {
    const criterion = await db.criterion.upsert({
      where: { standardVersionId_code: { standardVersionId: version.id, code: c.code } },
      update: { order: c.order, titleEn: c.titleEn, titleVi: c.titleVi },
      create: {
        standardVersionId: version.id,
        code: c.code,
        order: c.order,
        titleEn: c.titleEn,
        titleVi: c.titleVi,
      },
    });

    for (const [i, r] of c.requirements.entries()) {
      await db.requirement.upsert({
        where: { criterionId_code: { criterionId: criterion.id, code: r.code } },
        update: { title: r.title, guidance: r.guidance, order: i + 1 },
        create: {
          criterionId: criterion.id,
          code: r.code,
          order: i + 1,
          title: r.title,
          guidance: r.guidance,
        },
      });
    }

    // Minh chứng gợi ý: làm sạch rồi nạp lại (đồng bộ với dataset).
    await db.suggestedEvidence.deleteMany({ where: { criterionId: criterion.id } });
    for (const ev of c.suggestedEvidences ?? []) {
      await db.suggestedEvidence.create({
        data: { criterionId: criterion.id, description: ev },
      });
    }
  }

  return { standardId: standard.id, versionId: version.id };
}

/** Seed AUN-QA v4.0 (tương thích ngược). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function seedAunqa(db: any) {
  return seedStandard(db, AUNQA);
}
