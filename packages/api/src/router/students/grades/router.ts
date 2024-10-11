import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq, gt, isNull, or } from "@stu/db";
import { db } from "@stu/db/client";
import { Grades } from "@stu/db/schema";
import { GRADE_TYPES } from "@stu/lib";

import { protectedProcedure } from "../../../procedures";

export const grades = {
  upsert: protectedProcedure
    .input(
      z.object({
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
        await db
          .delete(Grades)
          .where(
            and(
              eq(Grades.student, user.id),
              eq(Grades.course, input.courseId),
              eq(Grades.type, input.type),
              or(
                isNull(Grades.teacherSignature),
                isNull(Grades.parentSignature),
              ),
            ),
          );

        const latestGrade = await db.query.Grades.findFirst({
          where: and(
            eq(Grades.student, user.id),
            eq(Grades.course, input.courseId),
            eq(Grades.type, input.type),
          ),
          orderBy: desc(Grades.date),
        });

        if (latestGrade && latestGrade.date.getTime() >= input.date.getTime()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot enter grades for a date in the past",
          });
        }

        await db.insert(Grades).values({
          course: input.courseId,
          date: input.date,
          result: input.result,
          student: user.id,
          type: input.type,
          parentSignature: user.isOfAge ? "NOT_REQUIRED" : null,
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

  confirmTeacher: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        course: z.string(),
        type: z.enum(GRADE_TYPES),
        signature: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(Grades)
        .set({
          teacherSignature: input.signature,
        })
        .where(
          and(
            eq(Grades.student, ctx.session.user.id),
            eq(Grades.course, input.course),
            eq(Grades.date, input.date),
            eq(Grades.type, input.type),
          ),
        );
    }),

  confirmParent: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        course: z.string(),
        type: z.enum(GRADE_TYPES),
        signature: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(Grades)
        .set({
          parentSignature: input.signature,
        })
        .where(
          and(
            eq(Grades.student, ctx.session.user.id),
            eq(Grades.course, input.course),
            eq(Grades.date, input.date),
            eq(Grades.type, input.type),
          ),
        );
    }),

  restore: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        course: z.string(),
        type: z.enum(GRADE_TYPES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(Grades)
        .where(
          and(
            eq(Grades.student, ctx.session.user.id),
            eq(Grades.course, input.course),
            eq(Grades.type, input.type),
            gt(Grades.date, input.date),
          ),
        );
    }),
} satisfies TRPCRouterRecord;
