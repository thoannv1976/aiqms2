import { AUNQA } from "./aunqa-data";

/**
 * Seed bộ tiêu chuẩn AUN-QA v4.0 (8 tiêu chí + thang 7 mức + yêu cầu đại diện).
 * Idempotent: upsert theo code/level/order. Nhận client Prisma (base hoặc extended)
 * — các model bộ tiêu chuẩn là GLOBAL nên không cần tenant context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedAunqa(db: any) {
  const standard = await db.accreditationStandard.upsert({
    where: { code: AUNQA.standard.code },
    update: { name: AUNQA.standard.name, description: AUNQA.standard.description },
    create: AUNQA.standard,
  });

  const version = await db.standardVersion.upsert({
    where: { standardId_version: { standardId: standard.id, version: AUNQA.version.version } },
    update: { name: AUNQA.version.name, isActive: AUNQA.version.isActive },
    create: { standardId: standard.id, ...AUNQA.version },
  });

  // Thang đánh giá 7 mức.
  for (const s of AUNQA.ratingScale) {
    await db.ratingScale.upsert({
      where: { standardVersionId_level: { standardVersionId: version.id, level: s.level } },
      update: { labelEn: s.labelEn, labelVi: s.labelVi },
      create: { standardVersionId: version.id, ...s },
    });
  }

  // 8 tiêu chí + yêu cầu + minh chứng gợi ý.
  for (const c of AUNQA.criteria) {
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
