import { z } from "zod";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const classes = createRouter({
  list: publicProcedure
    .input(z.object({ yearId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.class.findMany({
        where: { yearId: input.yearId },
        include: {
          courses: {
            include: { teacher: true, times: true },
          },
        },
      });
    }),
});
