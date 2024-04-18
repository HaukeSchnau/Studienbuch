import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  CourseSchema,
  CourseTimeSchema,
  UserSchema,
} from "@schnau/db/prisma/zod";
import { insertProtoCourse } from "@schnau/lib-server";

import { loginIservWithDefaultCredentials } from "../../../external-api/src/iserv";
import { permissionProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

const editCoursesProcedure = permissionProcedure("EDIT_COURSES");

export const courses = createRouter({
  list: publicProcedure
    .input(z.object({ yearId: z.number() }))
    .output(
      z.array(
        CourseSchema.omit({ createdAt: true }).extend({
          teacher: UserSchema.pick({ id: true, name: true, title: true }),
          times: z.array(CourseTimeSchema),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.course.findMany({
        where: {
          class: {
            yearId: input.yearId,
          },
          isChoosable: true,
        },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              title: true,
            },
          },
          class: true,
          times: true,
        },
      });
    }),

  addCourses: editCoursesProcedure
    .input(
      z.object({
        classId: z.number(),
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
    .mutation(async ({ ctx: { db }, input }) => {
      const { classId, courses } = input;
      const dbClass = await db.class.findUnique({
        where: {
          id: classId,
        },
      });
      if (!dbClass) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Class not found",
        });
      }

      const makeIservRequest = await loginIservWithDefaultCredentials();

      for (const course of courses) {
        await insertProtoCourse(db, dbClass, course, makeIservRequest);
      }
    }),
});
