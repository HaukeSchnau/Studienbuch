import { z } from "zod";

import { and, eq, notInArray } from "@schnau/db";
import { db } from "@schnau/db/client";
import { CourseSubscription } from "@schnau/db/schema";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const subscriptions = createRouter({
  subscribe: publicProcedure
    .input(
      z.object({ messagingToken: z.string(), courses: z.array(z.number()) }),
    )
    .output(z.void())
    .mutation(async ({ input }) => {
      await db
        .delete(CourseSubscription)
        .where(
          and(
            eq(CourseSubscription.messagingToken, input.messagingToken),
            notInArray(CourseSubscription.courseId, input.courses),
          ),
        );

      await db.insert(CourseSubscription).values(
        input.courses.map((course) => ({
          messagingToken: input.messagingToken,
          courseId: course,
        })),
      );
    }),
});
