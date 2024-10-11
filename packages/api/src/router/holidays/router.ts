import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools, Students } from "@stu/db/schema";
import { getHolidays } from "@stu/external-api";

import { protectedProcedure } from "../../procedures";

export interface Holdiay {
  end: string;
  name: string;
  slug: string;
  start: string;
  year: number;
}

export const holidays = {
  get: protectedProcedure
    .input(
      z.object({
        year: z.number(),
      }),
    )
    .query<Holdiay[]>(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        const [school] = await db
          .select({ stateCode: Schools.stateCode })
          .from(Schools)
          .innerJoin(Students, eq(Schools.id, Students.school))
          .where(eq(Students.person, user.id));

        if (!school) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "School not found",
          });
        }

        return getHolidays(school.stateCode, input.year);
      },
    ),
} satisfies TRPCRouterRecord;
