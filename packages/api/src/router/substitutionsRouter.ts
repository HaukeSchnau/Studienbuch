import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { CourseModel, SubstitutionModel } from "@acme/db/prisma/zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

dayjs.extend(utc);

export const substitutionsRouter = createTRPCRouter({
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
      console.log(dayjs.utc().startOf("day").toDate());
      return ctx.prisma.substitution
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
