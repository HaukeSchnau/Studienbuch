import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { CourseSchema, SubstitutionSchema } from "@schnau/db/prisma/zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

dayjs.extend(utc);

export const substitutions = createRouter({
  get: publicProcedure
    .input(
      z.object({
        date: z.date().optional(),
      }),
    )
    .output(
      z.array(
        SubstitutionSchema.extend({
          course: CourseSchema,
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.substitution
        .findMany({
          include: { course: true },
          where: {
            date: input.date ?? dayjs.utc().startOf("day").toDate(),
          },
        })
        .then((substitutions) => {
          return substitutions.map((substitution) => {
            const { lessonStart, lessonEnd } = substitution;
            return {
              ...substitution,
              lessonStart: lessonStart >= 8 ? lessonStart - 2 : lessonStart,
              lessonEnd: lessonStart >= 8 ? lessonEnd - 2 : lessonEnd,
            };
          });
        });
    }),
});
