import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { defaultTheme, SCHOOL_IDS, themeSchema } from "@stu/lib";

import { publicProcedure } from "../../procedures";

export const schools = {
  list: publicProcedure.input(z.void()).query(async () => {
    return db.query.Schools.findMany();
  }),

  getTheme: publicProcedure
    .input(z.enum(SCHOOL_IDS))
    .query(async ({ input }) => {
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
