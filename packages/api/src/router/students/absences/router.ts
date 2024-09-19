import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, isNotNull, isNull, or } from "@stu/db";
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
    return db.query.Absences.findMany({
      with: {
        course: true,
      },
      columns: {
        course: false,
      },
      where: and(
        eq(Absences.student, ctx.session.user.id),
        isNull(Absences.teacherSignature), // Teacher's signature is the last step, so if it's null, the absence is unexcused
      ),
    });
  }),

  listExcused: protectedProcedure.query(({ ctx }) => {
    return db.query.Absences.findMany({
      with: {
        course: true,
      },
      columns: {
        course: false,
      },
      where: and(
        eq(Absences.student, ctx.session.user.id),
        isNotNull(Absences.teacherSignature), // Teacher's signature is the last step, so if it's not null, the absence is excused
      ),
    });
  }),
} satisfies TRPCRouterRecord;
