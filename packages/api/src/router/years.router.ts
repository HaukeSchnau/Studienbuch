import { z } from "zod";

import { YearModel } from "@schnau/db/prisma/zod";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

const getYearNumber = (startYear: number) => {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (now.getMonth() < 8) {
    return currentYear - startYear + 5 - 1;
  }

  return currentYear - startYear + 5;
};

export const years = createRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/years" } })
    .input(z.void())
    .output(z.array(YearModel.omit({ createdAt: true })))
    .query(async ({ ctx }) => {
      return ctx.db.year
        .findMany()
        .then((years) =>
          years.filter((year) => getYearNumber(year.startYear) <= 13),
        );
    }),
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.year.findMany();
  }),
  add: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        startYear: z.number(),
        graduationYear: z.number(),
        schoolId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.year.create({
        data: {
          name: input.name,
          startYear: input.startYear,
          graduationYear: input.graduationYear,

          school: {
            connect: {
              id: input.schoolId,
            },
          },
        },
      });
    }),
});
