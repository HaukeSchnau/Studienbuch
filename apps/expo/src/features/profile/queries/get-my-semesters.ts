import { queryOptions } from "@tanstack/react-query";
import { desc, eq } from "drizzle-orm";

import * as t from "@stu/student/schema";

import { db } from "~/db/client";

export const getMySemesters = ({ userId }: { userId: string }) =>
  queryOptions({
    queryKey: ["my-semesters", userId],
    queryFn: () =>
      db
        .selectDistinct({
          name: t.semesters.name,
          start: t.semesters.start,
          end: t.semesters.end,
          type: t.semesters.type,
          year: t.semesters.year,
        })
        .from(t.semesters)
        .innerJoin(t.schools, eq(t.schools.id, t.semesters.school))
        .innerJoin(t.students, eq(t.students.school, t.schools.id))
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
        .where(eq(t.students.person, userId))
        .orderBy(desc(t.semesters.start))
        .limit(6)
        .then((semesters) => semesters.reverse()),
  });
