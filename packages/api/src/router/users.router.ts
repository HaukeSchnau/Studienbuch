import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { hashPassword } from "@schnau/auth/src/password";
import { asc, eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import { PermissionOnUser, PERMISSIONS, User } from "@schnau/db/schema";

import { permissionProcedure } from "../procedures";
import { createRouter } from "../trpc";

const scopeOptions = ["schools", "years", "classes", "courses"] as const;

const editUsersProcedure = permissionProcedure("EDIT_USERS");

const UserSchema = createInsertSchema(User);

export const users = createRouter({
  list: editUsersProcedure.query(async () => {
    return (
      await db.query.User.findMany({
        orderBy: asc(User.name),
        with: {
          rolesToUsers: {
            with: {
              role: true,
            },
          },
          permissionOnUsers: true,
        },
      })
    ).map(
      ({ passwordHash, rolesToUsers, permissionOnUsers, ...publicUser }) => ({
        ...publicUser,
        roles: rolesToUsers.map(({ role }) => role),
        permissions: permissionOnUsers,
        hasPassword: passwordHash !== null,
      }),
    );
  }),

  updateMany: editUsersProcedure
    .input(z.array(UserSchema.partial().required({ id: true })))
    .mutation(async ({ input }) => {
      await Promise.all(
        input.map((update) => {
          return db.update(User).set(update).where(eq(User.id, update.id));
        }),
      );
    }),

  add: editUsersProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().optional(),
        password: z.string().optional(),
        title: z.string().optional(),
        abbrv: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.insert(User).values({
        email: input.email,
        name: input.name,
        passwordHash: input.password
          ? await hashPassword(input.password)
          : null,
        title: input.title,
        abbrv: input.abbrv,
        updatedAt: new Date(),
      });
    }),

  updatePassword: editUsersProcedure
    .input(
      z.object({
        id: z.number(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const hashedPassword = await hashPassword(input.password);
      await db
        .update(User)
        .set({ passwordHash: hashedPassword })
        .where(eq(User.id, input.id));
    }),

  delete: editUsersProcedure.input(z.number()).mutation(async ({ input }) => {
    await db.delete(User).where(eq(User.id, input));
  }),

  listScopeOptions: editUsersProcedure
    .input(z.enum(scopeOptions))
    .query(async ({ input: option }) => {
      switch (option) {
        case "schools":
          return await db.query.School.findMany({
            columns: {
              id: true,
              name: true,
            },
          });
        case "years":
          return db.query.Year.findMany({
            columns: {
              id: true,
              name: true,
            },
          });
        case "classes":
          return db.query.Class.findMany({
            columns: {
              id: true,
              identifierInYear: true,
            },
          }).then((classes) =>
            classes.map(({ id, identifierInYear: name }) => ({ id, name })),
          );
        case "courses":
          return db.query.Course.findMany({
            columns: {
              id: true,
              courseId: true,
            },
          }).then((courses) =>
            courses.map(({ id, courseId: name }) => ({ id, name })),
          );
      }
    }),

  setPermissions: editUsersProcedure
    .input(
      z.object({
        userId: z.number(),
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
        .update(User)
        .set({ isSuperUser: input.isSuperUser })
        .where(eq(User.id, input.userId));
      await db
        .delete(PermissionOnUser)
        .where(eq(PermissionOnUser.userId, input.userId));
      await db.insert(PermissionOnUser).values(
        input.permissions.map((permission) => ({
          userId: input.userId,
          permission: permission.permission,
          scope: permission.scope ? permission.scope : undefined,
        })),
      );
    }),
});
