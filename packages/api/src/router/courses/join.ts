import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, count, eq } from "@stu/db";
import { db } from "@stu/db/client";
import {
  CourseMemberships,
  LicenseKeys,
  Schools,
  Students,
  Users,
} from "@stu/db/schema";
import { isArraySingleElement, SCHOOL_IDS, SEMESTER_TYPES } from "@stu/lib";

import { protectedProcedure } from "../../procedures";

export const join = protectedProcedure
  .input(
    z.object({
      courseIds: z.array(z.string()),
      semesterType: z.enum(SEMESTER_TYPES),
      semesterYear: z.number(),
      school: z.enum(SCHOOL_IDS),
      classIdentifier: z.string(),
      startYear: z.number(),
      isOfAge: z.boolean(),
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
        .from(Users)
        .innerJoin(LicenseKeys, eq(Users.id, LicenseKeys.activatedBy))
        .innerJoin(Schools, eq(LicenseKeys.school, Schools.id))
        .where(and(eq(Users.id, user.id), eq(Schools.id, input.school)));
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

      await db
        .insert(Students)
        .values({
          person: user.id,
          school: input.school,
          startYear: input.startYear,
          classIdentifier: input.classIdentifier,
          isOfAge: input.isOfAge,
        })
        .onConflictDoUpdate({
          target: [Students.person],
          set: {
            school: input.school,
            startYear: input.startYear,
            classIdentifier: input.classIdentifier,
            isOfAge: input.isOfAge,
          },
        });

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
  );
