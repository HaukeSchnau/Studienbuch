import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { CourseModel, CourseTimeModel, UserModel } from "@schnau/db/prisma/zod";
import { insertProtoCourse } from "@schnau/lib/src/courses/insertProtoCourse";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const courses = createRouter({
  list: publicProcedure
    .meta({ openapi: { method: "GET", path: "/courses/{yearId}" } })
    .input(z.object({ yearId: z.number() }))
    .output(
      z.array(
        CourseModel.omit({ createdAt: true }).extend({
          teacher: UserModel.pick({ id: true, name: true, title: true }),
          times: z.array(CourseTimeModel),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.course.findMany({
        where: { yearId: input.yearId },
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

  addCourses: protectedProcedure
    .input(
      z.object({
        yearId: z.number(),
        idInYear: z.string(),
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
      const { yearId, idInYear, courses } = input;
      const dbYear = await db.year.findUnique({ where: { id: yearId } });
      if (!dbYear) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Year not found",
        });
      }

      const dbClass = await db.class.upsert({
        where: {
          classIdentifier: {
            identifierInYear: idInYear,
            yearId: dbYear.id,
          },
        },
        create: {
          identifierInYear: idInYear,
          year: {
            connect: {
              id: dbYear.id,
            },
          },
        },
        update: {},
      });

      for (const course of courses) {
        await insertProtoCourse(db, dbYear, dbClass, course);
      }
    }),
});
