import { prisma } from "@/lib/prisma/client";
import { writeAudit } from "@/lib/audit/log";
import { unauthorized } from "@/lib/http/responses";
import { verifyPassword } from "./password";
import { signAuthToken } from "./jwt";

/** Xác thực bằng email + mật khẩu trong phạm vi tenant hiện tại (chạy trong tenantRoute). */
export async function loginWithCredentials(
  tenant: { id: string; slug: string },
  email: string,
  password: string,
) {
  const user = await prisma.user.findFirst({
    where: { email, status: "active" },
    include: { userRoles: { include: { role: true } } },
  });
  // Thông điệp mơ hồ để không lộ email tồn tại hay không.
  const invalid = unauthorized("Email hoặc mật khẩu không đúng");
  if (!user) throw invalid;
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid;

  const roles = [...new Set(user.userRoles.map((ur) => ur.role.code))];
  const token = await signAuthToken({
    sub: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    roles,
    isSuperAdmin: user.isSuperAdmin,
  });
  await writeAudit({ action: "auth.login", entity: "User", entityId: user.id });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      isSuperAdmin: user.isSuperAdmin,
    },
  };
}
