import { z } from "zod";

import {
  ClassModel,
  CourseModel,
  CourseTimeModel,
  UserModel,
} from "@schnau/db/prisma/zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const classes = createRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/classes/{yearId}" } })
    .input(z.object({ yearId: z.number() }))
    .output(
      z.array(
        ClassModel.extend({
          courses: z.array(
            CourseModel.extend({
              teacher: UserModel,
              times: z.array(CourseTimeModel),
            }),
          ),
        }),
      ),
    )
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
