import { z } from "zod";

import { RoleSchema, UserSchema } from "@schnau/db/prisma/zod";
import { hashPassword } from "@schnau/lib/src/auth/password";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { createRouter } from "../trpc";

export const users = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return (
      await ctx.db.user.findMany({
        orderBy: { name: "asc" },
      })
    ).map(({ passwordHash, ...publicUser }) => ({
      ...publicUser,
      hasPassword: passwordHash !== null,
    }));
  }),

  updateMany: protectedProcedure
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

  add: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().optional(),
        password: z.string().optional(),
        title: z.string().optional(),
        abbrv: z.string().optional(),
        role: RoleSchema,
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
          role: input.role,
        },
      });
    }),

  updatePassword: protectedProcedure
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

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.delete({
        where: { id: input },
      });
    }),
});
