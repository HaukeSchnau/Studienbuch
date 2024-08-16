import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq, gte } from "@schnau/db";
import { db } from "@schnau/db/client";
import { Year } from "@schnau/db/schema";
import { getMaxActiveGraduationYear } from "@schnau/lib";

import { permissionProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

const editYearsProcedure = permissionProcedure("EDIT_YEARS");

export const years = createRouter({
  list: publicProcedure
    .input(
      z.object({
        school: z.number().optional(),
        activeOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input: { school, activeOnly } }) => {
      console.log(getMaxActiveGraduationYear());
      return db.query.Year.findMany({
        where: and(
          school !== undefined ? eq(Year.schoolId, school) : undefined,
          activeOnly
            ? gte(Year.graduationYear, getMaxActiveGraduationYear())
            : undefined,
        ),
        orderBy: desc(Year.startYear),
      });
    }),

  listGroupedBySchool: publicProcedure.query(() => {
    return db.query.School.findMany({
      with: {
        years: {
          where: gte(Year.graduationYear, getMaxActiveGraduationYear()),
        },
      },
    });
  }),

  getOne: publicProcedure.input(z.number()).query(async ({ input }) => {
    const year = await db.query.Year.findFirst({
      where: eq(Year.id, input),
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
    .mutation(async ({ input }) => {
      await db.insert(Year).values({
        name: input.name,
        startYear: input.startYear,
        graduationYear: input.graduationYear,
        schoolId: input.schoolId,
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
    .mutation(async ({ input }) => {
      await db
        .update(Year)
        .set({
          name: input.name,
          startYear: input.startYear,
          graduationYear: input.graduationYear,
          schoolId: input.schoolId,
        })
        .where(eq(Year.id, input.id));
    }),
});
