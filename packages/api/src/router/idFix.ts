import { z } from "zod";

import { CourseModel, UserModel } from "@acme/db/prisma/zod";

import { publicProcedure } from "../trpc";
import "@total-typescript/ts-reset";

const fixedType = z.array(
  z.object({
    originalId: z.number(),
    fixedId: z.number().nullable(),
  }),
);

export const idFix = publicProcedure
  .input(
    z.object({
      courses: z.array(CourseModel),
      users: z.array(UserModel.pick({ abbrv: true, id: true, name: true })),
    }),
  )
  .output(
    z.object({
      fixedUsers: fixedType,
      fixedCourses: fixedType,
    }),
  )
  .query(async ({ ctx, input }) => {
    const fixedUsers = await Promise.all(
      input.users.map(async (user) => ({
        originalId: user.id,
        fixedId: await ctx.prisma.user
          .findFirst({
            where: {
              abbrv: user.abbrv ?? undefined,
              name: user.name ?? undefined,
            },
          })
          .then((user) => user?.id ?? null),
      })),
    );

    const fixedCourses = await Promise.all(
      input.courses.map(async (course) => {
        const fixedCourse = await ctx.prisma.course.findFirst({
          where: {
            name: course.name ?? undefined,
            teacherId: course.teacherId ?? undefined,
            yearId: course.yearId ?? undefined,
            courseId: course.courseId ?? undefined,
          },
          include: {
            year: true,
          },
        });
        if (fixedCourse?.year?.name === "Hans") {
          return;
        }
        return {
          originalId: course.id,
          fixedId: fixedCourse?.id ?? null,
        };
      }),
    ).then((courses) => courses.filter(Boolean));

    return { fixedUsers, fixedCourses };
  });
