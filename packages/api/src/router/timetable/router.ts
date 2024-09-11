import { TRPCRouterRecord } from "@trpc/server";
import { endOfWeek, startOfWeek } from "date-fns";
import { z } from "zod";

import { and, between, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import {
  Classes,
  CourseMemberships,
  Courses,
  SemesterCourses,
  SemesterCoursesToClasses,
  SemesterCoursesToClassesRelations,
  Semesters,
  Students,
  Substitutions,
  TimetableEntries,
} from "@stu/db/schema";

import { protectedProcedure } from "../../procedures";

export const timetable = {
  getWeek: protectedProcedure
    .input(
      z.object({
        date: z.date(),
      }),
    )
    .query(
      async ({
        input: { date },
        ctx: {
          session: { user },
        },
      }) => {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = endOfWeek(date, { weekStartsOn: 1 });
        const timetableEntries = await db
          .select()
          .from(TimetableEntries)
          .innerJoin(
            SemesterCourses,
            and(
              eq(TimetableEntries.course, SemesterCourses.course),
              eq(TimetableEntries.semesterType, SemesterCourses.semesterType),
              eq(TimetableEntries.semesterYear, SemesterCourses.semesterYear),
              eq(TimetableEntries.school, SemesterCourses.school),
            ),
          )
          .innerJoin(
            CourseMemberships,
            and(
              eq(SemesterCourses.course, CourseMemberships.course),
              eq(SemesterCourses.semesterType, CourseMemberships.semesterType),
              eq(SemesterCourses.semesterYear, CourseMemberships.semesterYear),
              eq(SemesterCourses.school, CourseMemberships.school),
            ),
          )
          .innerJoin(
            SemesterCoursesToClasses,
            and(
              eq(SemesterCoursesToClasses.course, SemesterCourses.course),
              eq(
                SemesterCoursesToClasses.semesterType,
                SemesterCourses.semesterType,
              ),
              eq(
                SemesterCoursesToClasses.semesterYear,
                SemesterCourses.semesterYear,
              ),
              eq(SemesterCoursesToClasses.school, SemesterCourses.school),
            ),
          )
          .innerJoin(
            Students,
            and(
              eq(CourseMemberships.student, Students.person),
              eq(
                SemesterCoursesToClasses.classIdentifier,
                Students.classIdentifier,
              ),
              eq(SemesterCoursesToClasses.classStartYear, Students.startYear),
            ),
          )
          .innerJoin(Courses, eq(CourseMemberships.course, Courses.id))
          .leftJoin(
            Substitutions,
            and(
              eq(TimetableEntries.start, Substitutions.start),
              eq(TimetableEntries.course, Substitutions.course),
            ),
          )
          .where(
            and(
              between(TimetableEntries.start, start, end),
              eq(Students.person, user.id),
            ),
          );
        console.log(
          timetableEntries.map((entry) => ({
            name: entry.courses.name,
            date: entry.timetable_entries.start,
            cls: entry.semester_courses_to_classes.classIdentifier,
            startYear: entry.semester_courses_to_classes.classStartYear,
          })),
        );

        return timetableEntries;
      },
    ),
} satisfies TRPCRouterRecord;
