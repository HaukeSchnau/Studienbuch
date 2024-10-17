import {
  endOfISOWeek,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from "date-fns";

import type { AppRouter } from "@stu/api";
import type { AgendaEntry } from "@stu/lib";

import type { ClientRouter } from "../utils/local-trpc/trpc-util";
import { getStorage, setStorage } from "~/utils/storage";
import { alias, and, asc, between, eq } from ".";
import { db } from "./client";
import {
  Courses,
  CoursesToClasses,
  CoursesToTeachers,
  Persons,
  Substitutions,
  TimetableEntries,
} from "./schema";

const Teachers = alias(Persons, "teachers");
const Substitute = alias(Persons, "substitute");

export const clientRouter: ClientRouter<AppRouter> = {
  auth: {
    getSession: {
      persist: (_, session) => setStorage("auth.session", session),
      read: () => getStorage("auth.session"),
    },
  },
  students: {
    timetable: {
      getWeek: {
        persist: (_, output) => {
          for (const entry of output) {
            db.insert(TimetableEntries).values({
              course: entry.course.id,
              duration: entry.duration,
              start: entry.start,
            });

            for (const substitution of entry.substitutions) {
              db.insert(Substitutions).values({
                course: entry.course.id,
                start: entry.start,
                substitute: substitution.substitute?.id,
                type: substitution.type,
              });
            }
          }
        },
        read: async ({ isoWeek, isoWeekYear }) => {
          const start = startOfISOWeek(
            setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek),
          );
          const end = endOfISOWeek(
            setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek + 1),
          );

          const rows = await db
            .select()
            .from(TimetableEntries)
            .innerJoin(Courses, eq(TimetableEntries.course, Courses.id))
            .innerJoin(
              CoursesToClasses,
              eq(CoursesToClasses.course, Courses.id),
            )
            .innerJoin(
              CoursesToTeachers,
              eq(CoursesToTeachers.course, Courses.id),
            )
            .innerJoin(Teachers, eq(CoursesToTeachers.teacher, Teachers.id))
            .leftJoin(
              Substitutions,
              and(
                eq(TimetableEntries.start, Substitutions.start),
                eq(TimetableEntries.course, Substitutions.course),
              ),
            )
            .leftJoin(Substitute, eq(Substitutions.substitute, Substitute.id))
            .where(between(TimetableEntries.start, start, end))
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
      },
    },
  },
};
