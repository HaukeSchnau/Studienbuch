import { z } from "zod";

import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Years } from "@stu/db/schema";
import { SCHOOL_IDS } from "@stu/lib";

import { permissionProcedure } from "../../../procedures";
import { createRouter } from "../../../trpc";

const editYearsProcedure = permissionProcedure("EDIT_YEARS");

export const years = createRouter({
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
