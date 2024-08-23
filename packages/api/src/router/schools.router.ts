import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { School } from "@stu/db/schema";
import { defaultTheme, themeSchema } from "@stu/lib";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const schools = createRouter({
  list: publicProcedure.input(z.void()).query(async () => {
    return db.query.School.findMany();
  }),

  setTheme: protectedProcedure
    .input(
      z.object({
        school: z.number(),
        image: z.string().optional(),
        theme: themeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return db
        .update(School)
        .set({
          image: input.image,
          theme: input.theme,
        })
        .where(eq(School.id, input.school));
    }),

  getTheme: publicProcedure.input(z.number()).query(async ({ input }) => {
    const school = await db.query.School.findFirst({
      where: eq(School.id, input),
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
});
