import { z } from "zod";

import { UserSchema } from "@schnau/db/prisma/zod";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { createRouter } from "../trpc";

export const users = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.user.findMany({
      orderBy: { name: "asc" },
    });
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
});
