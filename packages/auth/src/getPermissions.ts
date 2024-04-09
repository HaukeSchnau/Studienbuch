import type { Permission, PermissionScope } from "@schnau/lib";
import { db } from "@schnau/db";

export const getPermissions = async (user: {
  id: number;
  isSuperUser: boolean;
}): Promise<
  { isSuperUser: boolean } & Partial<Record<Permission, PermissionScope>>
> => {
  if (user.isSuperUser) {
    return {
      isSuperUser: true,
    };
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

  if (!userWithPermissions)
    return {
      isSuperUser: false,
    };

  const { permissions, roles } = userWithPermissions;

  const ret: { isSuperUser: boolean } & Partial<
    Record<Permission, PermissionScope>
  > = {
    isSuperUser: false,
  };

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
