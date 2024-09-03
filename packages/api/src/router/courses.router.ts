import { z } from "zod";

import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { SemesterCourses } from "@stu/db/schema";
import { SCHOOL_IDS, SEMESTER_TYPES } from "@stu/lib";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

// const editCoursesProxcedure = permissionProcedure("EDIT_COURSES");

export const courses = createRouter({
  listChoices: publicProcedure
    .input(
      z.object({
        school: z.enum(SCHOOL_IDS),
        startYear: z.number(),
        semesterYear: z.number(),
        semesterType: z.enum(SEMESTER_TYPES),
      }),
    )
    .query(async ({ input }) => {
      return db.query.SemesterCourses.findMany({
        where: and(
          eq(SemesterCourses.isChoosable, true),
          eq(SemesterCourses.school, input.school),
          eq(SemesterCourses.semesterYear, input.semesterYear),
          eq(SemesterCourses.semesterType, input.semesterType),
        ),
        with: {
          course: true,
          teachers: {
            with: {
              teacher: true,
            },
          },
          classes: {
            with: {
              class: true,
            },
          },
        },
      });
      // .then((rows) =>
      //   rows.map(({ persons: teacher, courses: course, classes }) => ({
      //     ...course,
      //     teacher,
      //     class: classes,
      //   })),
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
});
