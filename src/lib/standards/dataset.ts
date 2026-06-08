/** Cấu trúc dữ liệu cho một bộ tiêu chuẩn (data-driven). */
export interface RequirementSeed {
  code: string;
  title: string;
  guidance?: string;
}
export interface CriterionSeed {
  code: string;
  order: number;
  titleEn?: string;
  titleVi: string;
  requirements: RequirementSeed[];
  suggestedEvidences?: string[];
}
export interface StandardDataset {
  standard: { code: string; name: string; description?: string; level: string };
  version: { version: string; name?: string; isActive: boolean };
  ratingScale: { level: number; labelEn?: string; labelVi: string }[];
  criteria: CriterionSeed[];
}
