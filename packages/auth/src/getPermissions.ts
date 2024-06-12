import type { Permission, PermissionScope } from "@schnau/lib";
import { eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import {
  _RoleToUser,
  PermissionOnRole,
  PermissionOnUser,
  Role,
  User,
} from "@schnau/db/schema";

// TODO: Produce a single query to get the permission scope and maybe cache it
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

  const things = await db
    .select()
    .from(User)
    .where(eq(User.id, user.id))
    .leftJoin(PermissionOnUser, eq(PermissionOnUser.userId, User.id))
    .leftJoin(_RoleToUser, eq(_RoleToUser.B, User.id))
    .leftJoin(Role, eq(Role.id, _RoleToUser.A))
    .leftJoin(PermissionOnRole, eq(PermissionOnRole.roleId, Role.id));

  const ret: { isSuperUser: boolean } & Partial<
    Record<Permission, PermissionScope>
  > = {
    isSuperUser: false,
  };

  for (const thing of things) {
    if (thing.User.id !== user.id) {
      throw new Error("Unexpected user id");
    }

    if (thing.PermissionOnRole) {
      ret[thing.PermissionOnRole.permission] = (thing.PermissionOnRole.scope ??
        {}) as PermissionScope;
    }

    if (thing.PermissionOnUser) {
      ret[thing.PermissionOnUser.permission] = (thing.PermissionOnUser.scope ??
        {}) as PermissionScope;
    }
  }

  console.log(ret, things);

  return ret;
};
