import { z } from "zod";

import { YearModel } from "@schnau/db/prisma/zod";
import { getMaxActiveGraduationYear } from "@schnau/lib/src/year";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const years = createRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/years" } })
    .input(z.void())
    .output(z.array(YearModel.omit({ createdAt: true })))
    .query(async ({ ctx }) => {
      return ctx.db.year.findMany({
        where: {
          graduationYear: {
            gte: getMaxActiveGraduationYear(),
          },
        },
      });
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.year.findMany({
      orderBy: {
        startYear: "desc",
      },
    });
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
