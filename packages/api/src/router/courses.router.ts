import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Course as CourseT } from "@schnau/lib";
import { and, eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import {
  _ClassToCourse,
  Class,
  Course,
  CourseTime,
  User,
} from "@schnau/db/schema";
import { loginIservWithDefaultCredentials } from "@schnau/external-api";
import { insertProtoCourse } from "@schnau/lib-server";

import { permissionProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

const editCoursesProcedure = permissionProcedure("EDIT_COURSES");

export const courses = createRouter({
  list: publicProcedure
    .input(z.object({ yearId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(Course)
        .innerJoin(_ClassToCourse, eq(Course.id, _ClassToCourse.course))
        .innerJoin(
          Class,
          and(
            eq(_ClassToCourse.class, Class.id),
            eq(Class.yearId, input.yearId),
          ),
        )
        .innerJoin(CourseTime, eq(CourseTime.courseId, Course.id))
        .innerJoin(User, eq(Course.teacherId, User.id))
        .where(eq(Course.isChoosable, true))
        .then((rows) => {
          const result: Record<number, CourseT> = {};
          for (const { CourseTime, Course, User } of rows) {
            if (!result[Course.id]) {
              result[Course.id] = {
                ...Course,
                teacher: User,
                times: [],
              };
            }

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            result[Course.id]!.times.push(CourseTime);
          }
          return Object.values(result);
        });
    }),

  addCourses: editCoursesProcedure
    .input(
      z.object({
        classId: z.number(),
        semesterId: z.string(),
        courses: z.array(
          z.object({
            teacher: z.string(),
            normalizedCourseId: z.string(),
            guessedSubject: z.string(),
            room: z.string().optional(),
            isChoosable: z.boolean(),
            times: z.array(
              z.object({
                weekday: z.number(),
                start: z.number(),
                duration: z.number(),
                weeks: z.enum(["ODD", "EVEN", "BOTH"]),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const { classId, semesterId, courses } = input;
      const dbClass = await db.query.Class.findFirst({
        where: eq(Class.id, classId),
      });
      if (!dbClass) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Class not found",
        });
      }

      const makeIservRequest = await loginIservWithDefaultCredentials();

      for (const course of courses) {
        await insertProtoCourse(dbClass, semesterId, course, makeIservRequest);
      }
    }),
});
