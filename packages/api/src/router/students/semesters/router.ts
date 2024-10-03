import type { TRPCRouterRecord } from "@trpc/server";

import { desc, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools, Semesters, Students } from "@stu/db/schema";

import { protectedProcedure } from "../../../procedures";

export const semesters = {
  getOwn: protectedProcedure.query(
    async ({
      ctx: {
        session: { user },
      },
    }) => {
      const semesters = await db
        .selectDistinct({
          name: Semesters.name,
          start: Semesters.start,
          end: Semesters.end,
          type: Semesters.type,
          year: Semesters.year,
        })
        .from(Semesters)
        .innerJoin(Schools, eq(Schools.id, Semesters.school))
        .innerJoin(Students, eq(Students.school, Schools.id))
        // .innerJoin(
        //   Courses,
        //   and(
        //     eq(Courses.school, Semesters.school),
        //     eq(Courses.semesterType, Semesters.type),
        //     eq(Courses.semesterYear, Semesters.year),
        //   ),
        // )
        // .innerJoin(
        //   CourseMemberships,
        //   and(
        //     eq(CourseMemberships.course, Courses.id),
        //     eq(CourseMemberships.student, Students.person),
        //   ),
        // )
        .where(eq(Students.person, user.id))
        .orderBy(desc(Semesters.start))
        .limit(6);
      return semesters.reverse();
    },
  ),
} satisfies TRPCRouterRecord;
