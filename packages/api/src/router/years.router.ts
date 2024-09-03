import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq, gte } from "@stu/db";
import { db } from "@stu/db/client";
import { Years } from "@stu/db/schema";
import { getMaxActiveGraduationYear, SCHOOL_IDS } from "@stu/lib";

import { permissionProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

const editYearsProcedure = permissionProcedure("EDIT_YEARS");

export const years = createRouter({
  list: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS).optional(),
        activeOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input: { school, activeOnly } }) => {
      console.log(getMaxActiveGraduationYear());
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

  add: editYearsProcedure
    .input(
      z.object({
        name: z.string(),
        startYear: z.number(),
        graduationYear: z.number(),
        school: z.enum(SCHOOL_IDS),
      }),
    )
    .mutation(async ({ input }) => {
      await db.insert(Years).values({
        name: input.name,
        startYear: input.startYear,
        graduationYear: input.graduationYear,
        school: input.school,
      });
    }),

  update: editYearsProcedure
    .input(
      z.object({
        name: z.string(),
        startYear: z.number(),
        graduationYear: z.number(),
        school: z.enum(SCHOOL_IDS),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(Years)
        .set({
          name: input.name,
          graduationYear: input.graduationYear,
        })
        .where(
          and(
            eq(Years.school, input.school),
            eq(Years.startYear, input.startYear),
          ),
        );
    }),
});
