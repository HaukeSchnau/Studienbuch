import { queryOptions } from "@tanstack/react-query";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import * as t from "@stu/student/schema";

import { db } from "~/db/client";

export const getCourse = ({ courseId }: { courseId: string }) =>
  queryOptions({
    queryKey: ["courses", courseId],
    queryFn: async () => {
      const teachers = alias(t.persons, "teachers");
      const rows = await db
        .select()
        .from(t.courses)
        .innerJoin(
          t.semesters,
          and(
            eq(t.semesters.school, t.courses.school),
            eq(t.semesters.type, t.courses.semesterType),
            eq(t.semesters.year, t.courses.semesterYear),
          ),
        )
        .innerJoin(
          t.coursesToTeachers,
          eq(t.coursesToTeachers.course, t.courses.id),
        )
        .innerJoin(teachers, eq(teachers.id, t.coursesToTeachers.teacher))
        .where(eq(t.courses.id, courseId));

      const [first] = rows;

      if (!first) {
        throw new Error("Course not found");
      }

      return {
        id: first.courses.id,
        name: first.courses.name,
        longName: first.courses.longName,
        subject: first.courses.subject,
        teachers: rows.map((row) => row.teachers),
        semester: first.semesters,
      };
    },
  });
