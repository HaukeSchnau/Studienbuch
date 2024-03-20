import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { YearSchema } from "@schnau/db/prisma/zod";
import { getMaxActiveGraduationYear } from "@schnau/lib";

import { permissionProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

const editYearsProcedure = permissionProcedure("EDIT_YEARS");

export const years = createRouter({
  /**
   * @deprecated
   */
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/years" } })
    .input(z.void())
    .output(z.array(YearSchema.omit({ createdAt: true })))
    .query(({ ctx }) => {
      return ctx.db.year.findMany({
        where: {
          graduationYear: {
            gte: getMaxActiveGraduationYear(),
          },
        },
      });
    }),

  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.year.findMany({
      orderBy: {
        startYear: "desc",
      },
      include: {
        school: true,
      },
    });
  }),

  listGroupedBySchool: publicProcedure.query(({ ctx }) => {
    return ctx.db.school.findMany({
      include: {
        years: {
          where: {
            graduationYear: {
              gte: getMaxActiveGraduationYear(),
            },
          },
        },
      },
    });
  }),

  getOne: publicProcedure.input(z.number()).query(async ({ input, ctx }) => {
    const year = await ctx.db.year.findUnique({
      where: {
        id: input,
      },
    });

    if (!year) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Year not found",
      });
    }

    return year;
  }),

  add: editYearsProcedure
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

  update: editYearsProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        startYear: z.number(),
        graduationYear: z.number(),
        schoolId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.year.update({
        where: {
          id: input.id,
        },
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
