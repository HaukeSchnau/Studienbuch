import type { SemesterType } from "@stu/lib";
import * as t from "@stu/student/schema";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { and, eq } from "drizzle-orm";

import { db } from "~/db/client";

export const getMyCoursesForSemester = (
  semester:
    | {
        type: SemesterType;
        year: number;
      }
    | undefined,
) =>
  queryOptions({
    queryKey: ["my-courses", { semester }],
    queryFn: semester
      ? () =>
          // db
          //   .select({
          //     id: t.courses.id,
          //     name: t.courses.name,
          //     longName: t.courses.longName,
          //     subject: t.courses.subject,
          //     isMandatory: t.courses.isMandatory,
          //   })
          //   .from(t.courses)
          //   .where(
          //     and(
          //       eq(t.courses.isMember, true),
          //       eq(t.courses.semesterType, semester.type),
          //       eq(t.courses.semesterYear, semester.year),
          //     ),
          //   )
          db.query.courses
            .findMany({
              where: and(
                eq(t.courses.isMember, true),
                eq(t.courses.semesterType, semester.type),
                eq(t.courses.semesterYear, semester.year),
              ),
              with: {
                teachers: {
                  with: {
                    teacher: true,
                  },
                  columns: {
                    teacher: false,
                  },
                },
              },
            })
            .then((courses) =>
              courses.map((course) => ({
                ...course,
                teachers: course.teachers.map((t) => t.teacher),
              })),
            )
      : skipToken,
  });
