import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq, gte } from "@stu/db";
import { db } from "@stu/db/client";
import { Years } from "@stu/db/schema";
import { getMaxActiveGraduationYear, SCHOOL_IDS } from "@stu/lib";

import { publicProcedure } from "../../procedures";
import { createRouter } from "../../trpc";

export const years = createRouter({
  list: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS).optional(),
        activeOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input: { school, activeOnly } }) => {
      return db.query.Years.findMany({
        where: and(
          school !== undefined ? eq(Years.school, school) : undefined,
          activeOnly
            ? gte(Years.graduationYear, getMaxActiveGraduationYear())
            : undefined,
        ),
        orderBy: desc(Years.startYear),
      });
    }),

  listGroupedBySchool: publicProcedure.query(() => {
    return db.query.Schools.findMany({
      with: {
        years: {
          where: gte(Years.graduationYear, getMaxActiveGraduationYear()),
        },
      },
    });
  }),

  getOne: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS),
        startYear: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const year = await db.query.Years.findFirst({
        where: and(
          eq(Years.school, input.school),
          eq(Years.startYear, input.startYear),
        ),
      });

      if (!year) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Year not found",
        });
      }

      return year;
    }),
});
