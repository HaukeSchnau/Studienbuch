import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import {
  PermissionsToRoles,
  PermissionsToUsers,
  Roles,
  RolesToUsers,
  Users,
} from "@stu/db/schema";
import type { Permission, PermissionScope } from "@stu/lib";

// TODO: Produce a single query to get the permission scope and maybe cache it
export const getPermissions = async (user: {
  id: string;
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
    .from(Users)
    .where(eq(Users.id, user.id))
    .leftJoin(PermissionsToUsers, eq(PermissionsToUsers.user, Users.id))
    .leftJoin(RolesToUsers, eq(RolesToUsers.user, Users.id))
    .leftJoin(Roles, eq(Roles.id, RolesToUsers.role))
    .leftJoin(PermissionsToRoles, eq(PermissionsToRoles.role, Roles.id));

  const ret: { isSuperUser: boolean } & Partial<
    Record<Permission, PermissionScope>
  > = {
    isSuperUser: false,
  };

  for (const thing of things) {
    if (thing.users.id !== user.id) {
      throw new Error("Unexpected user id");
    }

    if (thing.permissions_to_roles) {
      ret[thing.permissions_to_roles.permission] = (thing.permissions_to_roles
        .scope ?? {}) as PermissionScope;
    }

    if (thing.permissions_to_users) {
      ret[thing.permissions_to_users.permission] = (thing.permissions_to_users
        .scope ?? {}) as PermissionScope;
    }
  }

  console.log(ret, things);

  return ret;
};
