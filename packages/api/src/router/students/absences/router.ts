import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, isNull, or } from "@stu/db";
import { db } from "@stu/db/client";
import { Absences } from "@stu/db/schema";

import { protectedProcedure } from "../../../procedures";

export const absences = {
  add: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        reason: z.string(),
        courseIds: z.array(z.string()),
      }),
    )
    .mutation(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        await db.insert(Absences).values(
          input.courseIds.map((courseId) => ({
            date: input.date,
            reason: input.reason,
            course: courseId,
            student: user.id,
          })),
        );
      },
    ),

  listUnexcused: protectedProcedure.query(({ ctx }) => {
    return db
      .select()
      .from(Absences)
      .where(
        and(
          eq(Absences.student, ctx.session.user.id),
          isNull(Absences.teacherSignature),
        ),
      );
  }),
} satisfies TRPCRouterRecord;
