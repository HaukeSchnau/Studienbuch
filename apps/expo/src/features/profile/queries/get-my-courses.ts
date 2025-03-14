import { queryOptions } from "@tanstack/react-query";
import { and, eq } from "drizzle-orm";

import type { SemesterType } from "@stu/lib";
import * as t from "@stu/student/schema";

import { db } from "~/db/client";

export const getMyCoursesForSemester = ({
  semester,
}: {
  semester: {
    type: SemesterType;
    year: number;
  };
}) =>
  queryOptions({
    queryKey: ["my-courses", { semester }],
    queryFn: () =>
      db
        .select({
          id: t.courses.id,
          name: t.courses.name,
          longName: t.courses.longName,
          subject: t.courses.subject,
        })
        .from(t.courses)
        .where(
          and(
            eq(t.courses.isMember, true),
            eq(t.courses.semesterType, semester.type),
            eq(t.courses.semesterYear, semester.year),
          ),
        ),
  });
