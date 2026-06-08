import { Prisma } from "@/generated/prisma/client";
import { getTenantContext } from "@/lib/tenant/context";
import { isTenantScoped } from "./tenant-models";

/**
 * Prisma Client Extension chèn bộ lọc tenant theo *từng request*.
 *
 * Bài học #4 (đắt nhất): KHÔNG đóng băng tenantId trong closure — luôn đọc từ
 * AsyncLocalStorage tại thời điểm truy vấn để tránh rò rỉ dữ liệu giữa các trường.
 */

const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const WHERE_WRITE_OPS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow"]);

function mergeTenantWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  return { ...(where ?? {}), tenantId };
}

export const tenantExtension = Prisma.defineExtension({
  name: "tenant-isolation",
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ model, operation, args, query }: any) {
        if (!isTenantScoped(model)) return query(args);

        const ctx = getTenantContext();
        if (!ctx) {
          throw new Error(
            `Truy vấn '${model}.${operation}' ngoài tenant context. ` +
              `Bọc trong runWithTenant() hoặc runAsSystem().`,
          );
        }
        // Super-admin / seed / job hệ thống: bỏ qua lọc tenant.
        if (ctx.bypassTenant) return query(args);

        const tenantId = ctx.tenantId;

        if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation)) {
          args.where = mergeTenantWhere(args.where, tenantId);
          return query(args);
        }

        if (operation === "create") {
          args.data = { ...args.data, tenantId };
          return query(args);
        }

        if (operation === "createMany" || operation === "createManyAndReturn") {
          const data = args.data;
          args.data = Array.isArray(data)
            ? data.map((d: Record<string, unknown>) => ({ ...d, tenantId }))
            : { ...data, tenantId };
          return query(args);
        }

        if (operation === "upsert") {
          args.where = mergeTenantWhere(args.where, tenantId);
          args.create = { ...args.create, tenantId };
          return query(args);
        }

        // findUnique/findUniqueOrThrow: Prisma chỉ cho phép cột unique trong where,
        // nên ta chạy rồi hậu-kiểm tenantId để tránh đọc nhầm dữ liệu trường khác.
        if (UNIQUE_OPS.has(operation)) {
          const result = await query(args);
          if (
            result &&
            typeof result === "object" &&
            "tenantId" in result &&
            (result as { tenantId: string }).tenantId !== tenantId
          ) {
            if (operation === "findUniqueOrThrow") {
              throw new Error("Bản ghi không thuộc tenant hiện tại.");
            }
            return null;
          }
          return result;
        }

        return query(args);
      },
    },
  },
});
