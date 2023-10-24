import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { CourseModel, SubstitutionModel } from "@acme/db/prisma/zod";

import { createRouter } from "../trpc";
import { publicProcedure } from "../procedures/publicProcedure";

dayjs.extend(utc);

export const substitutionsRouter = createRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/substitutions" } })
    .input(
      z.object({
        date: z.date().optional(),
      }),
    )
    .output(
      z.array(
        SubstitutionModel.extend({
          course: CourseModel,
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.substitution
        .findMany({
          include: { course: true },
          where: {
            date: input?.date ?? dayjs.utc().startOf("day").toDate(),
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
