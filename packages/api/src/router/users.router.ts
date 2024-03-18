import { z } from "zod";

import type { PermissionOnUser } from "@schnau/lib/src/auth/permissions/permisison";
import { hashPassword } from "@schnau/auth/src/password";
import { PermissionSchema, UserSchema } from "@schnau/db/prisma/zod";

import { permissionProcedure } from "../procedures/protectedProcedure";
import { createRouter } from "../trpc";

const scopeOptions = ["schools", "years", "classes", "courses"] as const;

const editUsersProcedure = permissionProcedure("EDIT_USERS");

export const users = createRouter({
  list: editUsersProcedure.query(async ({ ctx }) => {
    return (
      await ctx.db.user.findMany({
        orderBy: { name: "asc" },
        include: {
          roles: true,
          permissions: true,
        },
      })
    ).map(({ passwordHash, permissions, ...publicUser }) => ({
      ...publicUser,
      permissions: permissions as PermissionOnUser[],
      hasPassword: passwordHash !== null,
    }));
  }),

  updateMany: editUsersProcedure
    .input(
      z.array(
        UserSchema.pick({ id: true }).merge(
          UserSchema.partial().omit({ id: true }),
        ),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.map((update) => {
          return ctx.db.user.update({
            where: { id: update.id },
            data: update,
          });
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
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.password
            ? await hashPassword(input.password)
            : null,
          title: input.title,
          abbrv: input.abbrv,
        },
      });
    }),

  updatePassword: editUsersProcedure
    .input(
      z.object({
        id: z.number(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await hashPassword(input.password);
      await ctx.db.user.update({
        where: { id: input.id },
        data: {
          passwordHash: hashedPassword,
        },
      });
    }),

  delete: editUsersProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.delete({
        where: { id: input },
      });
    }),

  listScopeOptions: editUsersProcedure
    .input(z.enum(scopeOptions))
    .query(async ({ ctx, input: option }) => {
      switch (option) {
        case "schools":
          return ctx.db.school.findMany({
            select: { id: true, name: true },
          });
        case "years":
          return ctx.db.year.findMany({
            select: { id: true, name: true },
          });
        case "classes":
          return ctx.db.class
            .findMany({
              select: { id: true, identifierInYear: true },
            })
            .then((classes) =>
              classes.map((cls) => ({
                id: cls.id,
                name: cls.identifierInYear,
              })),
            );
        case "courses":
          return ctx.db.course
            .findMany({
              select: { id: true, courseId: true },
            })
            .then((courses) =>
              courses.map((course) => ({
                id: course.id,
                name: course.courseId,
              })),
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
            permission: PermissionSchema,
            scope: z.record(z.array(z.number())).nullable(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          isSuperUser: input.isSuperUser,
          permissions: {
            deleteMany: {},
            create: input.permissions.map((permission) => ({
              permission: permission.permission,
              scope: permission.scope ? permission.scope : undefined,
            })),
          },
        },
      });
    }),
});
