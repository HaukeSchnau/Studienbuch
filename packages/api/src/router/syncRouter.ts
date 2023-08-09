import { z } from "zod";

import {
  ClassModel,
  CourseModel,
  UserModel,
  YearModel,
} from "@acme/db/prisma/zod";

import { publicProcedure } from "../trpc";
import "@total-typescript/ts-reset";

export const sync = publicProcedure
  .meta({ openapi: { method: "POST", path: "/sync" } })
  .input(
    z.object({
      courseIds: z.array(z.number()),
      classIds: z.array(z.number()),
      yearIds: z.array(z.number()),
      userIds: z.array(z.number()),
      lastSync: z.date().optional(),
    }),
  )
  .output(
    z.object({
      updatedCourses: z.array(CourseModel),
      updatedClasses: z.array(ClassModel),
      updatedYears: z.array(YearModel),
      updatedUsers: z.array(UserModel),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { courseIds, classIds, yearIds, userIds, lastSync } = input;

    const updatedCourses = await ctx.prisma.course.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: courseIds,
        },
      },
    });

    const updatedClasses = await ctx.prisma.class.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: classIds,
        },
      },
    });

    const updatedYears = await ctx.prisma.year.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: yearIds,
        },
      },
    });

    const updatedUsers = await ctx.prisma.user.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: userIds,
        },
      },
    });

    return {
      updatedCourses,
      updatedClasses,
      updatedYears,
      updatedUsers,
    };
  });
