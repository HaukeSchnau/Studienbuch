import { queryOptions } from "@tanstack/react-query";
import { and, eq } from "drizzle-orm";

import type { GradeType } from "@stu/lib";
import * as t from "@stu/student/schema";

import { db } from "~/db/client";

export const getGrade = ({
  date,
  courseId,
  type,
}: {
  date: Date;
  courseId: string;
  type: GradeType;
}) =>
  queryOptions({
    queryKey: ["grades", { date, courseId, type }],
    queryFn: async () => {
      const grade = await db.query.grades.findFirst({
        where: and(eq(t.grades.course, courseId), eq(t.grades.date, date), eq(t.grades.type, type)),
        columns: {
          course: false,
        },
        with: {
          course: {
            with: {
              teachers: {
                columns: {
                  teacher: false,
                },
                with: {
                  teacher: true,
                },
              },
            },
          },
        },
      });

      if (!grade) {
        throw new Error("Grade not found");
      }

      return {
        ...grade,
        course: {
          ...grade.course,
          teachers: grade.course.teachers.map((t) => t.teacher),
        },
      };
    },
  });
