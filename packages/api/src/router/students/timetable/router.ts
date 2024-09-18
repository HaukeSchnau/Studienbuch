import type { TRPCRouterRecord } from "@trpc/server";
import {
  endOfISOWeek,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from "date-fns";
import { z } from "zod";

import type { AgendaEntry } from "@stu/lib";
import { alias, and, asc, between, eq } from "@stu/db";
import { db } from "@stu/db/client";
import {
  CourseMemberships,
  Courses,
  Persons,
  SemesterCourses,
  SemesterCoursesToClasses,
  SemesterCoursesToTeachers,
  Students,
  Substitutions,
  TimetableEntries,
} from "@stu/db/schema";

import { protectedProcedure } from "../../../procedures";

const Teachers = alias(Persons, "teachers");
const Substitute = alias(Persons, "substitute");

export const timetable = {
  getWeek: protectedProcedure
    .input(
      z.object({
        isoWeekYear: z.number(),
        isoWeek: z.number(),
      }),
    )
    .query(
      async ({
        input: { isoWeekYear, isoWeek },
        ctx: {
          session: { user },
        },
      }) => {
        const start = startOfISOWeek(
          setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek),
        );
        const end = endOfISOWeek(
          setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek + 1),
        );

        const rows = await db
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
            SemesterCoursesToTeachers,
            and(
              eq(SemesterCoursesToTeachers.course, SemesterCourses.course),
              eq(
                SemesterCoursesToTeachers.semesterType,
                SemesterCourses.semesterType,
              ),
              eq(
                SemesterCoursesToTeachers.semesterYear,
                SemesterCourses.semesterYear,
              ),
              eq(SemesterCoursesToTeachers.school, SemesterCourses.school),
            ),
          )
          .innerJoin(
            Teachers,
            eq(SemesterCoursesToTeachers.teacher, Teachers.id),
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
          .leftJoin(Substitute, eq(Substitutions.substitute, Substitute.id))
          .where(
            and(
              between(TimetableEntries.start, start, end),
              eq(Students.person, user.id),
            ),
          )
          .orderBy(asc(TimetableEntries.start), asc(TimetableEntries.course)); // Frontend expects the entries to be sorted

        const timetableEntries: AgendaEntry[] = [];
        let currentEntry: AgendaEntry | null = null;
        for (const row of rows) {
          if (
            !currentEntry ||
            currentEntry.start.getTime() !==
              row.timetable_entries.start.getTime() ||
            currentEntry.course.id !== row.timetable_entries.course
          ) {
            currentEntry = {
              start: row.timetable_entries.start,
              duration: row.timetable_entries.duration,
              course: {
                id: row.courses.id,
                name: row.courses.name,
                subject: row.courses.subject,
                teachers: [],
              },
              substitutions: [],
            };
            timetableEntries.push(currentEntry);
          }
          currentEntry.course.teachers.push({
            id: row.teachers.id,
            name: row.teachers.name,
            abbrv: row.teachers.abbrv,
            salutation: row.teachers.salutation,
          });
          if (row.substitutions) {
            currentEntry.substitutions.push({
              type: row.substitutions.type,
              substitute: row.substitute
                ? {
                    id: row.substitute.id,
                    abbrv: row.substitute.abbrv,
                    name: row.substitute.name,
                    salutation: row.substitute.salutation,
                  }
                : null,
            });
          }
        }

        return timetableEntries;
      },
    ),
} satisfies TRPCRouterRecord;
