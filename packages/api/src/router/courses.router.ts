import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Salutation, SubjectId } from "@stu/lib";
import { and, count, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import {
  Classes,
  CourseMemberships,
  Courses,
  LicenseKeys,
  Persons,
  Schools,
  SemesterCourses,
  SemesterCoursesToClasses,
  SemesterCoursesToTeachers,
  Semesters,
} from "@stu/db/schema";
import { isArraySingleElement, SCHOOL_IDS, SEMESTER_TYPES } from "@stu/lib";

import { protectedProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

// const editCoursesProxcedure = permissionProcedure("EDIT_COURSES");

export const courses = createRouter({
  listChoices: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS),
        startYear: z.number(),
        semester: z
          .object({
            year: z.number(),
            type: z.enum(SEMESTER_TYPES),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const semester = await (async () => {
        if (input.semester) {
          return input.semester;
        }

        const today = new Date();
        const semester = await db.query.Semesters.findFirst({
          where: and(lte(Semesters.start, today), gte(Semesters.end, today)),
        });
        if (!semester) {
          throw new Error("No current semester found");
        }
        return {
          type: semester.type,
          year: semester.year,
        };
      })();

      const rows = await db
        .select()
        .from(SemesterCourses)
        .innerJoin(Courses, eq(SemesterCourses.course, Courses.id))
        .innerJoin(
          SemesterCoursesToClasses,
          and(
            eq(SemesterCoursesToClasses.course, SemesterCourses.course),
            eq(
              SemesterCoursesToClasses.semesterType,
              SemesterCourses.semesterType,
            ),
            eq(
              SemesterCoursesToClasses.semesterYear,
              SemesterCourses.semesterYear,
            ),
            eq(SemesterCoursesToClasses.school, SemesterCourses.school),
          ),
        )
        .innerJoin(
          Classes,
          and(
            eq(
              SemesterCoursesToClasses.classIdentifier,
              Classes.identifierInYear,
            ),
            eq(SemesterCoursesToClasses.classStartYear, Classes.startYear),
            eq(SemesterCoursesToClasses.school, Classes.school),
          ),
        )
        .innerJoin(
          Semesters,
          and(
            eq(SemesterCourses.school, Semesters.school),
            eq(Semesters.type, SemesterCourses.semesterType),
            eq(Semesters.year, SemesterCourses.semesterYear),
          ),
        )
        .innerJoin(
          SemesterCoursesToTeachers,
          and(
            eq(SemesterCoursesToTeachers.course, SemesterCourses.course),
            eq(
              SemesterCoursesToTeachers.semesterType,
              SemesterCourses.semesterType,
            ),
            eq(
              SemesterCoursesToTeachers.semesterYear,
              SemesterCourses.semesterYear,
            ),
            eq(SemesterCoursesToTeachers.school, SemesterCourses.school),
          ),
        )
        .innerJoin(Persons, eq(SemesterCoursesToTeachers.teacher, Persons.id))
        .where(
          and(
            eq(SemesterCourses.isChoosable, true),
            eq(SemesterCourses.school, input.school),
            eq(SemesterCourses.semesterYear, semester.year),
            eq(SemesterCourses.semesterType, semester.type),
            eq(Classes.startYear, input.startYear),
          ),
        );

      const result = new Map<
        string,
        {
          id: string;
          name: string;
          subject: SubjectId;
          isChoosable: boolean;
          teachers: {
            id: string;
            name: string;
            abbrv: string | null;
            salutation: Salutation | null;
          }[];
          classes: {
            identifierInYear: string;
            startYear: number;
            school: string;
          }[];
          semesterType: string;
          semesterYear: number;
        }
      >();

      for (const row of rows) {
        if (!result.has(row.courses.id)) {
          result.set(row.courses.id, {
            classes: [],
            id: row.courses.id,
            isChoosable: row.semester_courses.isChoosable,
            name: row.courses.name,
            semesterType: row.semesters.type,
            semesterYear: row.semesters.year,
            subject: row.courses.subject,
            teachers: [],
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const course = result.get(row.courses.id)!;
        course.classes.push({
          identifierInYear: row.classes.identifierInYear,
          school: row.classes.school,
          startYear: row.classes.startYear,
        });
        course.teachers.push({
          abbrv: row.persons.abbrv,
          id: row.persons.id,
          name: row.persons.name,
          salutation: row.persons.salutation,
        });
      }

      return Array.from(result.values());

      // return db.query.SemesterCourses.findMany({
      //   columns: {
      //     course: false,
      //   },
      //   where: and(
      //     eq(SemesterCourses.isChoosable, true),
      //     eq(SemesterCourses.school, input.school),
      //     eq(SemesterCourses.semesterYear, semester.year),
      //     eq(SemesterCourses.semesterType, semester.type),
      //   ),
      //   with: {
      //     course: true,
      //     teachers: {
      //       with: {
      //         teacher: true,
      //       },
      //     },
      //     classes: {
      //       with: {
      //         class: true,
      //       },
      //       where: eq(Classes.startYear, input.startYear),
      //     },
      //   },
      // }).then((rows) =>
      //   rows
      //     .map(
      //       ({
      //         course,
      //         teachers,
      //         classes,
      //         isChoosable,
      //         school,
      //         semesterType,
      //         semesterYear,
      //       }) => ({
      //         ...course,
      //         teachers,
      //         classes,
      //         isChoosable,
      //         school,
      //         semesterType,
      //         semesterYear,
      //       }),
      //     )
      //     .filter((course) => course.classes.length > 0),
      // );
    }),

  // addCourses: editCoursesProcedure
  //   .input(
  //     z.object({
  //       classId: z.number(),
  //       semesterId: z.string(),
  //       courses: z.array(
  //         z.object({
  //           teacher: z.string(),
  //           normalizedCourseId: z.string(),
  //           guessedSubject: z.string(),
  //           room: z.string().optional(),
  //           isChoosable: z.boolean(),
  //           times: z.array(
  //             z.object({
  //               weekday: z.number(),
  //               start: z.number(),
  //               duration: z.number(),
  //               weeks: z.enum(["ODD", "EVEN", "BOTH"]),
  //             }),
  //           ),
  //         }),
  //       ),
  //     }),
  //   )
  //   .mutation(async ({ input }) => {
  //     const { classId, semesterId, courses } = input;
  //     const dbClass = await db.query.Class.findFirst({
  //       where: eq(Class.id, classId),
  //     });
  //     if (!dbClass) {
  //       throw new TRPCError({
  //         code: "NOT_FOUND",
  //         message: "Class not found",
  //       });
  //     }

  //     const makeIservRequest = await loginIservWithDefaultCredentials();

  //     for (const course of courses) {
  //       await insertProtoCourse(dbClass, semesterId, course, makeIservRequest);
  //     }
  //   }),

  join: protectedProcedure
    .input(
      z.object({
        courseIds: z.array(z.string()),
        semesterType: z.enum(SEMESTER_TYPES),
        semesterYear: z.number(),
        school: z.enum(SCHOOL_IDS),
      }),
    )
    .mutation(
      async ({
        input,
        ctx: {
          session: { user },
        },
      }) => {
        const rows = await db
          .select({
            count: count(),
          })
          .from(Persons)
          .innerJoin(LicenseKeys, eq(Persons.id, LicenseKeys.activatedBy))
          .innerJoin(Schools, eq(LicenseKeys.school, Schools.id))
          .where(and(eq(Persons.id, user.id), eq(Schools.id, input.school)));
        if (!isArraySingleElement(rows)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Expected exactly one row",
          });
        }
        if (rows[0].count === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not allowed to join this school",
          });
        }

        await db.transaction(async (db) => {
          await db
            .delete(CourseMemberships)
            .where(
              and(
                eq(CourseMemberships.student, user.id),
                eq(CourseMemberships.semesterType, input.semesterType),
                eq(CourseMemberships.semesterYear, input.semesterYear),
                eq(CourseMemberships.school, input.school),
              ),
            );

          await db.insert(CourseMemberships).values(
            input.courseIds.map((course) => ({
              student: user.id,
              course,
              semesterType: input.semesterType,
              semesterYear: input.semesterYear,
              school: input.school,
            })),
          );
        });
      },
    ),
});
