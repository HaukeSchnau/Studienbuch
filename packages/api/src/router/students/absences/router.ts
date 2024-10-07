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
          parentSignature: user.isOfAge ? "NOT_REQUIRED" : null,
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

  getOne: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        courses: z.array(z.string()),
      }),
    )
    .query(async ({ input, ctx }) => {
      const absence = await db.query.AbsenceDays.findFirst({
        with: {
          absenceCourses: {
            with: {
              course: {
                with: {
                  teachers: {
                    with: {
                      teacher: true,
                    },
                  },
                },
              },
            },
            columns: {
              course: false,
            },
            where: inArray(CourseAbsences.course, input.courses),
          },
        },
        where: and(
          eq(AbsenceDays.student, ctx.session.user.id),
          eq(AbsenceDays.date, input.date),
        ),
      });

      return absence && absence.absenceCourses.length > 0
        ? {
            ...absence,
            absenceCourses: absence.absenceCourses.map((course) => ({
              ...course,
              course: {
                ...course.course,
                teachers: course.course.teachers.map(
                  (teacher) => teacher.teacher,
                ),
              },
            })),
          }
        : null;
    }),

  listUnexcused: protectedProcedure.query(async ({ ctx }) => {
    const absences = await db.query.AbsenceDays.findMany({
      with: {
        absenceCourses: {
          with: {
            course: true,
          },
          columns: {
            course: false,
          },
          where: isNull(CourseAbsences.teacherSignature),
        },
      },
      where: eq(AbsenceDays.student, ctx.session.user.id),
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
        await db
          .delete(CourseAbsences)
          .where(
            and(
              eq(CourseAbsences.date, input.date),
              eq(CourseAbsences.student, user.id),
              inArray(CourseAbsences.course, input.courseIds),
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

  excuseParent: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        signature: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(AbsenceDays)
        .set({
          parentSignature: input.signature,
        })
        .where(
          and(
            eq(AbsenceDays.student, ctx.session.user.id),
            eq(AbsenceDays.date, input.date),
          ),
        );
    }),

  excuseTeacher: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        courseId: z.string(),
        signature: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(CourseAbsences)
        .set({
          teacherSignature: input.signature,
        })
        .where(
          and(
            eq(CourseAbsences.student, ctx.session.user.id),
            eq(CourseAbsences.date, input.date),
            eq(CourseAbsences.course, input.courseId),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
