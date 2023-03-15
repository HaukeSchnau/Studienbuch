import { z } from "zod";

import {
  ClassModel,
  CourseModel,
  CourseTimeModel,
  UserModel,
} from "@acme/db/prisma/zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const classesRouter = createTRPCRouter({
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
      return ctx.prisma.class.findMany({
        where: { yearId: input.yearId },
        include: {
          courses: {
            include: { teacher: true, times: true },
          },
        },
      });
    }),
});
