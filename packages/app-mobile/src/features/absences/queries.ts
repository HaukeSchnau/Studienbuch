import * as t from "@stu/student/schema";
import { queryOptions } from "@tanstack/react-query";
import { eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "~/db/client";

export const listUnexcused = () =>
  queryOptions({
    queryKey: ["absences", "listUnexcused"],
    queryFn: () =>
      db.query.absenceDays
        .findMany({
          with: {
            absenceCourses: {
              with: {
                course: true,
              },
              columns: {
                course: false,
              },
              where: isNull(t.courseAbsences.teacherSignature),
            },
          },
        })
        .then((absences) => absences.filter((absence) => absence.absenceCourses.length > 0)),
  });

export const listExcused = () =>
  queryOptions({
    queryKey: ["absences", "listExcused"],
    queryFn: () =>
      db.query.absenceDays
        .findMany({
          with: {
            absenceCourses: {
              with: {
                course: true,
              },
              columns: {
                course: false,
              },
              where: isNotNull(t.courseAbsences.teacherSignature),
            },
          },
        })
        .then((absences) => absences.filter((absence) => absence.absenceCourses.length > 0)),
  });

export const getOne = ({ date, courseIds }: { date: Date; courseIds: string[] }) =>
  queryOptions({
    queryKey: ["absences", "getOne", date, courseIds],
    queryFn: async () => {
      const absence = await db.query.absenceDays.findFirst({
        with: {
          absenceCourses: {
            with: {
              course: {
                with: {
                  teachers: {
                    with: {
                      teacher: true,
                    },
                  },
                },
              },
            },
            columns: {
              course: false,
            },
            where: inArray(t.courseAbsences.course, courseIds),
          },
        },
        where: eq(t.absenceDays.date, date),
      });

      return absence && absence.absenceCourses.length > 0
        ? {
            ...absence,
            absenceCourses: absence.absenceCourses.map((course) => ({
              ...course,
              course: {
                ...course.course,
                teachers: course.course.teachers.map((teacher) => teacher.teacher),
              },
            })),
          }
        : null;
    },
  });
