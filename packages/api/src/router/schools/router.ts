import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { defaultTheme, SCHOOL_IDS, themeSchema } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure } from "../../procedures";
import { classes } from "../../router-legacy/schools/classes/router";
import { courses } from "../../router-legacy/schools/courses/router";
import { semesters } from "../../router-legacy/schools/semesters/router";
import { years } from "../../router-legacy/schools/years/router";

export const schools = {
  classes,
  courses,
  semesters,
  years,

  list: publicProcedure.input(z.void()).query(async () => {
    return db.query.Schools.findMany();
  }),

  getTheme: publicProcedure.input(z.enum(SCHOOL_IDS)).query(async ({ input }) => {
    const school = await db.query.Schools.findFirst({
      where: eq(Schools.id, input),
      columns: {
        theme: true,
        image: true,
      },
    });
    if (!school) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "School not found",
      });
    }

    const parsedTheme = themeSchema.safeParse(school.theme);

    if (!parsedTheme.success) {
      return {
        theme: defaultTheme,
      };
    }

    return {
      theme: parsedTheme.data,
      image: school.image,
    };
  }),
} satisfies TRPCRouterRecord;
