import { z } from "zod";

import { CourseModel, CourseTimeModel, UserModel } from "@schnau/db/prisma/zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const coursesRouter = createRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/courses/{yearId}" } })
    .input(z.object({ yearId: z.number() }))
    .output(
      z.array(
        CourseModel.omit({ createdAt: true }).extend({
          teacher: UserModel.pick({ id: true, name: true, title: true }),
          times: z.array(CourseTimeModel),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.course.findMany({
        where: { yearId: input.yearId },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
          class: true,
          times: true,
        },
      });
    }),
});
