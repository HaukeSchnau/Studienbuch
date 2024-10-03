import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { alias, and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import {
  CourseMemberships,
  Courses,
  CoursesToTeachers,
  Persons,
  Semesters,
  SemesterType,
  TeachersToClasses,
} from "@stu/db/schema";
import { SEMESTER_TYPES } from "@stu/lib";

import { protectedProcedure } from "../../../procedures";

export const courses = {
  getForSemester: protectedProcedure
    .input(
      z.object({
        semester: z.object({
          type: z.enum(SEMESTER_TYPES),
          year: z.number(),
        }),
      }),
    )
    .query(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        const courses = await db
          .select({
            id: Courses.id,
            name: Courses.name,
            longName: Courses.longName,
            subject: Courses.subject,
          })
          .from(Courses)
          .innerJoin(
            CourseMemberships,
            eq(CourseMemberships.course, Courses.id),
          )
          .where(
            and(
              eq(CourseMemberships.student, user.id),
              eq(Courses.semesterType, input.semester.type),
              eq(Courses.semesterYear, input.semester.year),
            ),
          );

        return courses;
      },
    ),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        const Teachers = alias(Persons, "teachers");
        const rows = await db
          .select()
          .from(Courses)
          .innerJoin(
            CourseMemberships,
            eq(CourseMemberships.course, Courses.id),
          )
          .innerJoin(
            Semesters,
            and(
              eq(Semesters.school, Courses.school),
              eq(Semesters.type, Courses.semesterType),
              eq(Semesters.year, Courses.semesterYear),
            ),
          )
          .innerJoin(
            CoursesToTeachers,
            eq(CoursesToTeachers.course, Courses.id),
          )
          .innerJoin(Teachers, eq(Teachers.id, CoursesToTeachers.teacher))
          .where(
            and(
              eq(CourseMemberships.student, user.id),
              eq(Courses.id, input.id),
            ),
          );

        const [first] = rows;

        if (!first) {
          throw new TRPCError({
            code: "NOT_FOUND",
          });
        }

        return {
          id: first.courses.id,
          name: first.courses.name,
          longName: first.courses.longName,
          subject: first.courses.subject,
          teachers: rows.map((row) => row.teachers),
          semester: first.semesters,
        };
      },
    ),
} satisfies TRPCRouterRecord;
