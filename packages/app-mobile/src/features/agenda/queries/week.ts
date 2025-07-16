import type { AgendaEntry } from "@stu/lib";
import * as t from "@stu/student/schema";
import { queryOptions } from "@tanstack/react-query";
import { endOfISOWeek, setISOWeek, setISOWeekYear, startOfISOWeek } from "date-fns";
import { and, asc, between, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "~/db/client";

export const getTimetableWeek = ({ isoWeekYear, isoWeek }: { isoWeekYear: number; isoWeek: number }) =>
  queryOptions({
    queryKey: ["timetable.week", { isoWeekYear, isoWeek }],
    queryFn: async () => {
      const start = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek));
      const end = endOfISOWeek(setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek + 1));

      const teachers = alias(t.persons, "teachers");
      const substitute = alias(t.persons, "substitute");

      const rows = await db
        .select()
        .from(t.timetableEntries)
        .innerJoin(t.courses, eq(t.timetableEntries.course, t.courses.id))
        .innerJoin(t.coursesToClasses, eq(t.courses.id, t.coursesToClasses.course))
        .innerJoin(t.coursesToTeachers, eq(t.courses.id, t.coursesToTeachers.course))
        .innerJoin(teachers, eq(t.coursesToTeachers.teacher, teachers.id))
        .leftJoin(
          t.substitutions,
          and(
            eq(t.timetableEntries.start, t.substitutions.start),
            eq(t.timetableEntries.course, t.substitutions.course),
          ),
        )
        .leftJoin(substitute, eq(t.substitutions.substitute, substitute.id))
        .where(and(between(t.timetableEntries.start, start, end), eq(t.courses.isMember, true)))
        .orderBy(asc(t.timetableEntries.start), asc(t.timetableEntries.course));

      const timetableEntries: AgendaEntry[] = [];
      let currentEntry: AgendaEntry | null = null;
      for (const row of rows) {
        if (
          !currentEntry ||
          currentEntry.start.getTime() !== row.timetable_entries.start.getTime() ||
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
          firstName: row.teachers.firstName,
          lastName: row.teachers.lastName,
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
                  firstName: row.substitute.firstName,
                  lastName: row.substitute.lastName,
                  salutation: row.substitute.salutation,
                }
              : null,
          });
        }
      }

      return timetableEntries;
    },
  });
