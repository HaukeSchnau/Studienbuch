import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const subscriptionsRouter = createTRPCRouter({
  subscribe: publicProcedure
    .meta({ openapi: { method: "POST", path: "/subscriptions" } })
    .input(
      z.object({ messagingToken: z.string(), courses: z.array(z.number()) }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.courseSubscription.deleteMany({
        where: {
          messagingToken: input.messagingToken,
          courseId: { notIn: input.courses },
        },
      });

      await ctx.prisma.courseSubscription.createMany({
        skipDuplicates: true,
        data: input.courses.map((course) => ({
          messagingToken: input.messagingToken,
          courseId: course,
        })),
      });
    }),
});
