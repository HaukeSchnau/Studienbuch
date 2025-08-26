import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Years } from "@stu/db/schema";
import { SCHOOL_IDS, Year, YearRepository } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";
import { runtime } from "../../../groundswell";
import { publicProcedure } from "../../../procedures";

export const years = {
  list: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS).optional(),
        activeOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input: { school, activeOnly } }) =>
      runtime.runPromise(
        activeOnly ? Year.activeYears : YearRepository.pipe(Effect.andThen((repo) => repo.getAllYears({ school }))),
      ),
    ),

  getOne: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS),
        startYear: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const year = await db.query.Years.findFirst({
        where: and(eq(Years.school, input.school), eq(Years.startYear, input.startYear)),
      });

      if (!year) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Year not found",
        });
      }

      return year;
    }),
} satisfies TRPCRouterRecord;
