import { z } from "zod";

import {
  ClassSchema,
  CourseSchema,
  CourseTimeSchema,
  UserSchema,
} from "@schnau/db/prisma/zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const classes = createRouter({
  list: publicProcedure
    .meta({ openapi: { method: "GET", path: "/classes/{yearId}" } })
    .input(z.object({ yearId: z.number() }))
    .output(
      z.array(
        ClassSchema.extend({
          courses: z.array(
            CourseSchema.extend({
              teacher: UserSchema,
              times: z.array(CourseTimeSchema),
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
