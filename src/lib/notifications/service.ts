import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { notFound } from "@/lib/http/responses";

/** Tạo thông báo cho danh sách người dùng (khử trùng, bỏ rỗng). */
export async function notify(userIds: string[], input: { title: string; body?: string; link?: string }) {
  const ctx = requireTenantContext();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return { sent: 0 };
  await prisma.notification.createMany({
    data: ids.map((userId) => withTenantId({ userId, title: input.title, body: input.body ?? null, link: input.link ?? null, createdBy: ctx.actorId })),
  });
  return { sent: ids.length };
}

/** Thông báo của người dùng hiện tại (mới nhất trước). */
export async function listMyNotifications(unreadOnly = false, take = 30) {
  const ctx = requireTenantContext();
  const where = { userId: ctx.actorId, ...(unreadOnly ? { read: false } : {}) };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take }),
    prisma.notification.count({ where: { userId: ctx.actorId, read: false } }),
  ]);
  return { items, unread };
}

export async function markNotificationRead(id: string) {
  const ctx = requireTenantContext();
  const n = await prisma.notification.findFirst({ where: { id, userId: ctx.actorId } });
  if (!n) throw notFound("Thông báo không tồn tại");
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllRead() {
  const ctx = requireTenantContext();
  const r = await prisma.notification.updateMany({ where: { userId: ctx.actorId, read: false }, data: { read: true } });
  return { updated: r.count };
}
