import { z } from "zod";

import {
  ClassModel,
  CourseModel,
  CourseTimeModel,
  UserModel,
  YearModel,
} from "@schnau/db/prisma/zod";

import "@total-typescript/ts-reset";

import { publicProcedure } from "../procedures/publicProcedure";

export const sync = publicProcedure
  .meta({ openapi: { method: "POST", path: "/sync" } })
  .input(
    z.object({
      courseIds: z.array(z.number()),
      classIds: z.array(z.number()),
      yearIds: z.array(z.number()),
      userIds: z.array(z.number()),
      lastSync: z.coerce.date().nullish(),
    }),
  )
  .output(
    z.object({
      updatedCourses: z.array(CourseModel),
      updatedCourseTimes: z.array(CourseTimeModel),
      updatedClasses: z.array(ClassModel),
      updatedYears: z.array(YearModel),
      updatedUsers: z.array(UserModel),
    }),
  )
  .query(async ({ ctx, input }) => {
    const {
      courseIds,
      classIds,
      yearIds,
      userIds,
      lastSync: lastSyncNullish,
    } = input;
    const lastSync = lastSyncNullish ?? undefined;

    const updatedCourses = await ctx.db.course.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: courseIds,
        },
      },
    });

    const updatedCourseTimes = await ctx.db.courseTime.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        courseId: {
          in: courseIds,
        },
      },
    });

    const updatedClasses = await ctx.db.class.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: [...classIds, ...updatedCourses.map((course) => course.classId)],
        },
      },
    });

    const updatedYears = await ctx.db.year.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: [...yearIds, ...updatedClasses.map((class_) => class_.yearId)],
        },
      },
    });

    const updatedUsers = await ctx.db.user.findMany({
      where: {
        updatedAt: {
          gt: lastSync,
        },
        id: {
          in: [...userIds, ...updatedCourses.map((course) => course.teacherId)],
        },
      },
    });

    return {
      updatedCourses,
      updatedCourseTimes,
      updatedClasses,
      updatedYears,
      updatedUsers,
    };
  });
