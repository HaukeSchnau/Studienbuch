import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Grades } from "@stu/db/schema";
import { GRADE_TYPES } from "@stu/lib";

import { protectedProcedure } from "../../../procedures";

export const grades = {
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
        )
        .orderBy(desc(Grades.date));
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        course: z.string(),
        type: z.enum(GRADE_TYPES),
      }),
    )
    .query(async ({ input, ctx }) => {
      const grade = await db.query.Grades.findFirst({
        where: and(
          eq(Grades.student, ctx.session.user.id),
          eq(Grades.course, input.course),
          eq(Grades.date, input.date),
          eq(Grades.type, input.type),
        ),
        columns: {
          course: false,
        },
        with: {
          course: {
            with: {
              teachers: {
                columns: {
                  teacher: false,
                },
                with: {
                  teacher: true,
                },
              },
            },
          },
        },
      });

      if (!grade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grade not found",
        });
      }

      return {
        ...grade,
        course: {
          ...grade.course,
          teachers: grade.course.teachers.map((t) => t.teacher),
        },
      };
    }),
} satisfies TRPCRouterRecord;
