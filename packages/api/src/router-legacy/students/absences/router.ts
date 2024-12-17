import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, inArray, isNotNull, isNull } from "@stu/db";
import { db } from "@stu/db/client";
import { AbsenceDays, CourseAbsences } from "@stu/db/schema";

import { protectedProcedure } from "../../../procedures";

export const absences = {
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
} satisfies TRPCRouterRecord;
