import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { PermissionsToRoles, PermissionsToUsers, Roles, RolesToUsers, Users } from "@stu/db/schema";
import type { Permission, PermissionScope } from "@stu/lib";

// TODO: Produce a single query to get the permission scope and maybe cache it
export const findPermissionScope = async (userId: string, permission: Permission): Promise<PermissionScope | null> => {
  const user = await db.query.Users.findFirst({
    where: eq(Users.id, userId),
  });
  if (!user) {
    return null;
  }
  if (user.isSuperUser) {
    return {};
  }

  const things = await db
    .select()
    .from(Users)
    .where(and(eq(Users.id, user.id)))
    .leftJoin(
      PermissionsToUsers,
      and(eq(PermissionsToUsers.user, Users.id), eq(PermissionsToUsers.permission, permission)),
    )
    .leftJoin(RolesToUsers, eq(RolesToUsers.user, Users.id))
    .leftJoin(Roles, eq(Roles.id, RolesToUsers.role))
    .leftJoin(
      PermissionsToRoles,
      and(eq(PermissionsToRoles.role, Roles.id), eq(PermissionsToRoles.permission, permission)),
    );

  // TODO - this is just for debugging
  console.log(things);

  return null;
};
