import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import type { Permission, PermissionScope, Salutation } from "@stu/lib";
import { hashPassword } from "@stu/auth/src/password";
import { asc, eq } from "@stu/db";
import { db } from "@stu/db/client";
import {
  PERMISSIONS,
  PermissionsToUsers,
  Persons,
  Roles,
  RolesToUsers,
  Users,
} from "@stu/db/schema";
import { BetterMap, SALUTATIONS } from "@stu/lib";
import { createUser } from "@stu/lib-server";

import { permissionProcedure } from "../../../procedures";
import { createRouter } from "../../../trpc";

const scopeOptions = ["schools", "years", "classes", "courses"] as const;

const editUsersProcedure = permissionProcedure("EDIT_USERS");

const UserSchema = createInsertSchema(Users);

export const users = createRouter({
  list: editUsersProcedure.query(async () => {
    const rows = await db
      .select()
      .from(Users)
      .innerJoin(Persons, eq(Users.person, Persons.id))
      .leftJoin(PermissionsToUsers, eq(Users.id, PermissionsToUsers.user))
      .leftJoin(RolesToUsers, eq(Users.id, RolesToUsers.user))
      .leftJoin(Roles, eq(Roles.id, RolesToUsers.role))
      .orderBy(asc(Persons.name));

    const map = new BetterMap<
      string,
      {
        id: string;
        email: string | null;
        person: {
          id: string;
          name: string;
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
    >();

    for (const row of rows) {
      if (!map.get(row.users.id)) {
        map.set(row.users.id, {
          id: row.users.id,
          email: row.users.email,
          person: {
            id: row.persons.id,
            name: row.persons.name,
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

      if (row.roles) user.roles.push(row.roles);
      if (row.permissions_to_users)
        user.permissions.push({
          permission: row.permissions_to_users.permission,
          scope: row.permissions_to_users.scope as PermissionScope | null,
        });
    }

    return Array.from(map.values());
  }),

  updateMany: editUsersProcedure
    .input(z.array(UserSchema.partial().required({ id: true })))
    .mutation(async ({ input }) => {
      await Promise.all(
        input.map((update) => {
          return db.update(Users).set(update).where(eq(Users.id, update.id));
        }),
      );
    }),

  add: editUsersProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().optional(),
        password: z.string().optional(),
        salutation: z.enum(SALUTATIONS).optional(),
        abbrv: z.string().optional(),
        primaryRole: z.enum(["TEACHER", "STUDENT"]).optional(),
      }),
    )
    .mutation(async ({ input }) => createUser(input)),

  updatePassword: editUsersProcedure
    .input(
      z.object({
        id: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const hashedPassword = await hashPassword(input.password);
      await db
        .update(Users)
        .set({ passwordHash: hashedPassword })
        .where(eq(Users.id, input.id));
    }),

  delete: editUsersProcedure.input(z.string()).mutation(async ({ input }) => {
    await db.delete(Users).where(eq(Users.id, input));
  }),

  listScopeOptions: editUsersProcedure
    .input(z.enum(scopeOptions))
    .query(async ({ input: option }) => {
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
    }),

  setPermissions: editUsersProcedure
    .input(
      z.object({
        userId: z.string(),
        isSuperUser: z.boolean(),
        permissions: z.array(
          z.object({
            permission: z.enum(PERMISSIONS),
            scope: z.record(z.array(z.number())).nullable(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(Users)
        .set({ isSuperUser: input.isSuperUser })
        .where(eq(Users.id, input.userId));
      await db
        .delete(PermissionsToUsers)
        .where(eq(PermissionsToUsers.user, input.userId));
      await db.insert(PermissionsToUsers).values(
        input.permissions.map((permission) => ({
          user: input.userId,
          permission: permission.permission,
          scope: permission.scope ? permission.scope : undefined,
        })),
      );
    }),
});
