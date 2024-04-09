import { z } from "zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const subscriptions = createRouter({
  subscribe: publicProcedure
    .input(
      z.object({ messagingToken: z.string(), courses: z.array(z.number()) }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await ctx.db.courseSubscription.deleteMany({
        where: {
          messagingToken: input.messagingToken,
          courseId: { notIn: input.courses },
        },
      });

      await ctx.db.courseSubscription.createMany({
        skipDuplicates: true,
        data: input.courses.map((course) => ({
          messagingToken: input.messagingToken,
          courseId: course,
        })),
      });
    }),
});
