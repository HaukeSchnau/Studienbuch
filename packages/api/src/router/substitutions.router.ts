import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

dayjs.extend(utc);

export const substitutions = createRouter({
  get: publicProcedure
    .input(
      z.object({
        date: z.date().optional(),
      }),
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
