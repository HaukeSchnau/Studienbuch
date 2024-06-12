import type { Permission, PermissionScope } from "@schnau/lib";
import { and, eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import {
  _RoleToUser,
  PermissionOnRole,
  PermissionOnUser,
  Role,
  User,
} from "@schnau/db/schema";

// TODO: Produce a single query to get the permission scope and maybe cache it
export const findPermissionScope = async (
  user: { id: number; isSuperUser: boolean },
  permission: Permission,
): Promise<PermissionScope | null> => {
  if (user.isSuperUser) {
    return {};
  }

  const things = await db
    .select()
    .from(User)
    .where(and(eq(User.id, user.id)))
    .leftJoin(
      PermissionOnUser,
      and(
        eq(PermissionOnUser.userId, User.id),
        eq(PermissionOnUser.permission, permission),
      ),
    )
    .leftJoin(_RoleToUser, eq(_RoleToUser.B, User.id))
    .leftJoin(Role, eq(Role.id, _RoleToUser.A))
    .leftJoin(
      PermissionOnRole,
      and(
        eq(PermissionOnRole.roleId, Role.id),
        eq(PermissionOnRole.permission, permission),
      ),
    );

  // TODO - this is just for debugging
  console.log(things);

  return null;
};
