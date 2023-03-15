import { z } from "zod";

import { CourseModel, CourseTimeModel, UserModel } from "@acme/db/prisma/zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const coursesRouter = createTRPCRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/courses/{yearId}" } })
    .input(z.object({ yearId: z.number() }))
    .output(
      z.array(
        CourseModel.extend({
          teacher: UserModel.pick({ id: true, name: true, title: true }),
          times: z.array(CourseTimeModel),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.course.findMany({
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
