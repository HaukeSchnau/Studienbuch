import type { Permission, PermissionScope } from "@stu/lib";
import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import {
  _RoleToUser,
  PermissionOnRole,
  PermissionOnUser,
  Role,
  User,
} from "@stu/db/schema";

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
    .leftJoin(_RoleToUser, eq(_RoleToUser.user, User.id))
    .leftJoin(Role, eq(Role.id, _RoleToUser.role))
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
