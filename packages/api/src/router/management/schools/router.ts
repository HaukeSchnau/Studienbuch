import { z } from "zod";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { SCHOOL_IDS, themeSchema } from "@stu/lib";

import { protectedProcedure } from "../../../procedures";
import { createRouter } from "../../../trpc";

export const schools = createRouter({
  setTheme: protectedProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS),
        image: z.string().optional(),
        theme: themeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return db
        .update(Schools)
        .set({
          image: input.image,
          theme: input.theme,
        })
        .where(eq(Schools.id, input.school));
    }),
});
