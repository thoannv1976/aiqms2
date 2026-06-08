import { Prisma } from "@/generated/prisma/client";

/**
 * Soft-delete: bản ghi "xóa" chỉ set deletedAt (không xóa cứng — bài học #10).
 * Extension này tự thêm `deletedAt: null` vào các truy vấn đọc cho model có cột
 * deletedAt, để mặc định không trả bản ghi đã xóa. Muốn lấy cả bản đã xóa, truyền
 * `deletedAt` tường minh trong where (hoặc dùng includeDeleted helper).
 */
export const SOFT_DELETE_MODELS = new Set<string>([
  "User",
  "Faculty",
  "Department",
]);

const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export const softDeleteExtension = Prisma.defineExtension({
  name: "soft-delete",
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ model, operation, args, query }: any) {
        if (!model || !SOFT_DELETE_MODELS.has(model)) return query(args);

        if (READ_OPS.has(operation)) {
          const where = args.where ?? {};
          // Không ghi đè nếu caller đã chỉ định deletedAt.
          if (!("deletedAt" in where)) {
            args.where = { ...where, deletedAt: null };
          }
        }
        return query(args);
      },
    },
  },
});

/** Soft-delete một bản ghi: set deletedAt = now. */
export function softDeleteData(actorId?: string) {
  return { deletedAt: new Date(), updatedBy: actorId };
}
