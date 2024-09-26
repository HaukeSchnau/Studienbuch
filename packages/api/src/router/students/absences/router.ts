import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, inArray, isNotNull, isNull } from "@stu/db";
import { db } from "@stu/db/client";
import { AbsenceDays, CourseAbsences } from "@stu/db/schema";

import { protectedProcedure } from "../../../procedures";

export const absences = {
  add: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        reason: z.string(),
        courseIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        await db.insert(AbsenceDays).values({
          date: input.date,
          student: user.id,
          reason: input.reason,
        });
        await db.insert(CourseAbsences).values(
          input.courseIds.map((courseId) => ({
            date: input.date,
            student: user.id,
            course: courseId,
          })),
        );
      },
    ),

  listUnexcused: protectedProcedure
    .input(
      z
        .object({
          date: z.date().optional(),
          courses: z.array(z.string()).optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const absences = await db.query.AbsenceDays.findMany({
        with: {
          absenceCourses: {
            with: {
              course: true,
            },
            columns: {
              course: false,
            },
            where: and(
              isNull(CourseAbsences.teacherSignature),
              input.courses
                ? inArray(CourseAbsences.course, input.courses)
                : undefined,
            ),
          },
        },
        where: and(
          eq(AbsenceDays.student, ctx.session.user.id),
          input.date ? eq(AbsenceDays.date, input.date) : undefined,
        ),
      });

      return absences.filter((absence) => absence.absenceCourses.length > 0);
    }),

  listExcused: protectedProcedure.query(async ({ ctx }) => {
    const absences = await db.query.AbsenceDays.findMany({
      with: {
        absenceCourses: {
          with: {
            course: true,
          },
          columns: {
            course: false,
          },
          where: isNotNull(CourseAbsences.teacherSignature),
        },
      },
      where: eq(AbsenceDays.student, ctx.session.user.id),
    });

    return absences.filter((absence) => absence.absenceCourses.length > 0);
  }),

  delete: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        courseId: z.string().optional(),
      }),
    )
    .mutation(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        await db
          .delete(CourseAbsences)
          .where(
            and(
              eq(CourseAbsences.date, input.date),
              eq(CourseAbsences.student, user.id),
              input.courseId
                ? eq(CourseAbsences.course, input.courseId)
                : undefined,
            ),
          );

        const courseAbsences = await db.query.CourseAbsences.findMany({
          where: and(
            eq(CourseAbsences.date, input.date),
            eq(CourseAbsences.student, user.id),
          ),
        });

        if (courseAbsences.length === 0) {
          await db
            .delete(AbsenceDays)
            .where(
              and(
                eq(AbsenceDays.date, input.date),
                eq(AbsenceDays.student, user.id),
              ),
            );
        }
      },
    ),
} satisfies TRPCRouterRecord;
