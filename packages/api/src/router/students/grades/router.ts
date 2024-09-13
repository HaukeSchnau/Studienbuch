import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, isNull } from "@stu/db";
import { db } from "@stu/db/client";
import { Absences, Grades } from "@stu/db/schema";
import { GRADE_TYPES } from "@stu/lib";

import { protectedProcedure } from "../../../procedures";

export const grades = {
  add: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        courseId: z.string(),
        date: z.date(),
        result: z.number(),
        type: z.enum(GRADE_TYPES),
      }),
    )
    .mutation(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        await db.insert(Grades).values({
          id: input.id,
          course: input.courseId,
          date: input.date,
          result: input.result.toString(),
          student: user.id,
          type: input.type,
        });
      },
    ),

  list: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
      }),
    )
    .query(({ ctx, input }) => {
      return db
        .select()
        .from(Grades)
        .where(
          and(
            eq(Grades.student, ctx.session.user.id),
            eq(Grades.course, input.courseId),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
