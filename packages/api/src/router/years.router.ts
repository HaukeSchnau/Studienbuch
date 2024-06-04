import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getMaxActiveGraduationYear } from "@schnau/lib";

import { permissionProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

const editYearsProcedure = permissionProcedure("EDIT_YEARS");

export const years = createRouter({
  list: publicProcedure
    .input(
      z.object({
        school: z.number().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.year.findMany({
        where: {
          schoolId: input.school,
        },
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
