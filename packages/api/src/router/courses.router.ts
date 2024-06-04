import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { loginIservWithDefaultCredentials } from "@schnau/external-api";
import { insertProtoCourse } from "@schnau/lib-server";

import { permissionProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

const editCoursesProcedure = permissionProcedure("EDIT_COURSES");

export const courses = createRouter({
  list: publicProcedure
    .input(z.object({ yearId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.course.findMany({
        where: {
          classes: {
            some: {
              yearId: input.yearId,
            },
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
          classes: true,
          times: true,
        },
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
            room: z.string(),
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
      const { classId, semesterId, courses } = input;
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
        await insertProtoCourse(
          db,
          dbClass,
          semesterId,
          course,
          makeIservRequest,
        );
      }
    }),
});
