import { asc, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { PERMISSIONS, PermissionsToUsers, Persons, Roles, RolesToUsers, Users } from "@stu/db/schema";
import type { Permission, PermissionScope, Salutation } from "@stu/lib";
import { BetterMap, SALUTATIONS } from "@stu/lib";
import { z } from "zod";

import { hashPassword } from "../auth";
import { createUser } from "../users";

const updateUserInputSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable().optional(),
  passwordHash: z.string().nullable().optional(),
  isSuperUser: z.boolean().optional(),
  notificationTokens: z.array(z.string()).optional(),
});

export const updateManyUsersInputSchema = z.array(updateUserInputSchema);

export const addUserInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  password: z.string().optional(),
  salutation: z.enum(SALUTATIONS).optional(),
  abbrv: z.string().optional(),
});

export const updateUserPasswordInputSchema = z.object({
  id: z.string(),
  password: z.string(),
});

export const deleteUserInputSchema = z.string();

export const scopeOptions = ["schools", "years", "classes", "courses"] as const;
export const listUserScopeOptionsInputSchema = z.enum(scopeOptions);

export const setUserPermissionsInputSchema = z.object({
  userId: z.string(),
  isSuperUser: z.boolean(),
  permissions: z.array(
    z.object({
      permission: z.enum(PERMISSIONS),
      scope: z.record(z.array(z.number())).nullable(),
    }),
  ),
});

export type UpdateManyUsersInput = z.infer<typeof updateManyUsersInputSchema>;
export type AddUserInput = z.infer<typeof addUserInputSchema>;
export type UpdateUserPasswordInput = z.infer<typeof updateUserPasswordInputSchema>;
export type ListUserScopeOptionsInput = z.infer<typeof listUserScopeOptionsInputSchema>;
export type SetUserPermissionsInput = z.infer<typeof setUserPermissionsInputSchema>;

export interface ListedUser {
  id: string;
  email: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    salutation: Salutation | null;
    abbrv: string | null;
  };
  roles: { id: string; name: string }[];
  permissions: {
    permission: Permission;
    scope: PermissionScope | null;
  }[];
  hasPassword: boolean;
  isSuperUser: boolean;
}

export const listUsers = async (): Promise<ListedUser[]> => {
  const rows = await db
    .select()
    .from(Users)
    .innerJoin(Persons, eq(Users.id, Persons.id))
    .leftJoin(PermissionsToUsers, eq(Users.id, PermissionsToUsers.user))
    .leftJoin(RolesToUsers, eq(Users.id, RolesToUsers.user))
    .leftJoin(Roles, eq(Roles.id, RolesToUsers.role))
    .orderBy(asc(Persons.lastName), asc(Persons.firstName));

  const map = new BetterMap<string, ListedUser>();

  for (const row of rows) {
    if (!map.get(row.users.id)) {
      map.set(row.users.id, {
        id: row.users.id,
        email: row.users.email,
        person: {
          id: row.persons.id,
          firstName: row.persons.firstName,
          lastName: row.persons.lastName,
          email: row.persons.email,
          salutation: row.persons.salutation,
          abbrv: row.persons.abbrv,
        },
        roles: [],
        permissions: [],
        hasPassword: row.users.passwordHash !== null,
        isSuperUser: row.users.isSuperUser,
      });
    }

    const user = map.get(row.users.id);
    if (!user) {
      throw new Error("Logic error: Just added this user");
    }

    if (row.roles) {
      user.roles.push(row.roles);
    }
    if (row.permissions_to_users) {
      user.permissions.push({
        permission: row.permissions_to_users.permission,
        scope: row.permissions_to_users.scope as PermissionScope | null,
      });
    }
  }

  return Array.from(map.values());
};

export const updateManyUsers = async (input: UpdateManyUsersInput): Promise<void> => {
  await Promise.all(
    input.map((update) => {
      return db.update(Users).set(update).where(eq(Users.id, update.id));
    }),
  );
};

export const addUser = async (input: AddUserInput) => {
  return createUser(input);
};

export const updateUserPassword = async (input: UpdateUserPasswordInput): Promise<void> => {
  const hashedPassword = await hashPassword(input.password);
  await db.update(Users).set({ passwordHash: hashedPassword }).where(eq(Users.id, input.id));
};

export const deleteUser = async (userId: string): Promise<void> => {
  await db.delete(Users).where(eq(Users.id, userId));
};

export const listUserScopeOptions = async (option: ListUserScopeOptionsInput) => {
  switch (option) {
    case "schools":
      return await db.query.Schools.findMany({
        columns: {
          name: true,
        },
      });

    case "years":
      return db.query.Years.findMany({
        columns: {
          name: true,
          startYear: true,
          school: true,
        },
      });

    case "classes":
      return db.query.Classes.findMany({
        columns: {
          school: true,
          startYear: true,
          identifierInYear: true,
        },
      }).then((classes) =>
        classes.map(({ school, startYear, identifierInYear: name }) => ({
          school,
          startYear,
          name,
        })),
      );

    case "courses":
      return db.query.Courses.findMany({
        columns: {
          id: true,
          name: true,
        },
      });
  }
};

export const setUserPermissions = async (input: SetUserPermissionsInput): Promise<void> => {
  await db.update(Users).set({ isSuperUser: input.isSuperUser }).where(eq(Users.id, input.userId));
  await db.delete(PermissionsToUsers).where(eq(PermissionsToUsers.user, input.userId));
  await db.insert(PermissionsToUsers).values(
    input.permissions.map((permission) => ({
      user: input.userId,
      permission: permission.permission,
      scope: permission.scope ?? undefined,
    })),
  );
};
