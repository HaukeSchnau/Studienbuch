import type { Permission, PermissionScope } from "@schnau/lib";
import { db } from "@schnau/db";

export const getPermissions = async (user: {
  id: number;
  isSuperUser: boolean;
}): Promise<"ALL" | Partial<Record<Permission, PermissionScope>>> => {
  if (user.isSuperUser) {
    return "ALL";
  }

  const userWithPermissions = await db.user.findUnique({
    where: {
      id: user.id,
    },
    include: {
      permissions: true,
      roles: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!userWithPermissions) return {};

  const { permissions, roles } = userWithPermissions;

  const ret: Partial<Record<Permission, PermissionScope>> = {};

  for (const permission of permissions) {
    ret[permission.permission] = (permission.scope as PermissionScope) ?? {};
  }

  for (const role of roles) {
    for (const permission of role.permissions) {
      ret[permission.permission] = (permission.scope ??
        role.defaultScope ??
        {}) as PermissionScope;
    }
  }

  return ret;
};
