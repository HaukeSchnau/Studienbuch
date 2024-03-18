import type { Permission } from "@prisma/client";

import { db } from "@schnau/db";

import type { PermissionScope } from "./scope";

export const findPermissionScope = async (
  user: { id: number; isSuperUser: boolean },
  permission: Permission,
): Promise<PermissionScope | null> => {
  if (user.isSuperUser) {
    return {};
  }

  const foundPermission = await db.permissionOnUser.findFirst({
    where: {
      userId: user.id,
      permission,
    },
  });

  if (foundPermission) {
    return (foundPermission.scope ?? {}) as PermissionScope;
  }

  const foundPermissionOnRole = await db.role.findFirst({
    where: {
      users: {
        some: {
          id: user.id,
        },
      },
      permissions: {
        some: {
          permission,
        },
      },
    },
    include: {
      permissions: {
        where: {
          permission,
        },
      },
    },
  });

  if (foundPermissionOnRole?.permissions[0]) {
    return (foundPermissionOnRole.permissions[0].scope ??
      foundPermissionOnRole.defaultScope ??
      {}) as PermissionScope;
  }

  return null;
};

export const createPermissionScopeFilter = (scope: number[] | undefined) => {
  return scope ? { in: scope } : undefined;
};
