import {
  endOfISOWeek,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from "date-fns";

import type { AppRouter } from "@stu/api";
import type { AgendaEntry } from "@stu/lib";
import {
  AbsenceDays,
  Classes,
  CourseAbsences,
  Courses,
  CoursesToClasses,
  CoursesToTeachers,
  Persons,
  Schools,
  Semesters,
  Substitutions,
  TimetableEntries,
  Years,
} from "@stu/student/schema";

import type { ClientRouter } from "../utils/local-trpc/trpc-util";
import { alias, and, asc, between, eq, inArray, sql } from ".";
import { db } from "./client";

const Teachers = alias(Persons, "teachers");
const Substitute = alias(Persons, "substitute");

export const clientRouter: ClientRouter<AppRouter> = {
  // auth: {
  //   getSession: {
  //     persist: (_, session) => setStorage("auth.session", session),
  //     read: () => getStorage("auth.session"),
  //   },
  // },
  schools: {
    semesters: {
      getCurrent: {
        persist: async (_, output) => {
          await db
            .insert(Semesters)
            .values(output)
            .onConflictDoUpdate({
              target: [Semesters.school, Semesters.type, Semesters.year],
              set: {
                name: sql.raw(`excluded.${Semesters.name.name}`),
                start: sql.raw(`excluded.${Semesters.start.name}`),
                end: sql.raw(`excluded.${Semesters.end.name}`),
              },
            });
        },
      },
    },
    years: {
      list: {
        persist: async (_, output) => {
          // TODO: Make this non-hardcoded
          await db
            .insert(Schools)
            .values({
              id: "igs-lil",
              name: "IGS Lilienthal",
              stateCode: "NI",
            })
            .onConflictDoNothing();

          await db
            .insert(Years)
            .values(output)
            .onConflictDoUpdate({
              target: [Years.startYear, Years.school],
              set: {
                name: sql.raw(`excluded.${Years.name.name}`),
                graduationYear: sql.raw(
                  `excluded.${Years.graduationYear.name}`,
                ),
              },
            });
        },
      },
    },
    classes: {
      list: {
        persist: async (_, output) => {
          await db.insert(Classes).values(output).onConflictDoNothing();
        },
      },
    },
    courses: {
      listChoices: {
        persist: async (input, { courses, semester }) => {
          // TODO: This may not be necessary. Check if semester is already fetched. If it is, reduce the response
          await db
            .insert(Semesters)
            .values(semester)
            .onConflictDoUpdate({
              target: [Semesters.school, Semesters.type, Semesters.year],
              set: {
                name: sql.raw(`excluded.${Semesters.name.name}`),
                start: sql.raw(`excluded.${Semesters.start.name}`),
                end: sql.raw(`excluded.${Semesters.end.name}`),
              },
            });

          for (const course of courses) {
            await db
              .insert(Courses)
              .values({
                id: course.id,
                longName: course.name, // TODO: wrong field
                name: course.name,
                school: input.school,
                semesterType: course.semesterType,
                semesterYear: course.semesterYear,
                subject: course.subject,
                isMandatory: course.isMandatory,
                isMember: false,
              })
              .onConflictDoUpdate({
                target: [Courses.id],
                set: {
                  isMandatory: course.isMandatory,
                  longName: course.name,
                  name: course.name,
                  school: input.school,
                  semesterType: course.semesterType,
                  semesterYear: course.semesterYear,
                  subject: course.subject,
                },
              });

            await db
              .insert(CoursesToClasses)
              .values({
                school: input.school,
                classIdentifier: input.identifierInYear,
                classStartYear: input.startYear,
                course: course.id,
              })
              .onConflictDoNothing();

            for (const teacher of course.teachers) {
              await db
                .insert(Persons)
                .values({
                  id: teacher.id,
                  name: teacher.name,
                  abbrv: teacher.abbrv,
                  salutation: teacher.salutation,
                })
                .onConflictDoUpdate({
                  target: Persons.id,
                  set: {
                    abbrv: teacher.abbrv,
                    name: teacher.name,
                    salutation: teacher.salutation,
                  },
                });

              await db
                .insert(CoursesToTeachers)
                .values({
                  course: course.id,
                  teacher: teacher.id,
                })
                .onConflictDoNothing();
            }
          }
        },
      },
    },
  },
  students: {
    timetable: {
      getWeek: {
        persist: async (_, output) => {
          for (const entry of output) {
            await db
              .insert(TimetableEntries)
              .values({
                course: entry.course.id,
                duration: entry.duration,
                start: entry.start,
              })
              .onConflictDoUpdate({
                target: [TimetableEntries.course, TimetableEntries.start],
                set: {
                  duration: entry.duration,
                },
              });

            for (const substitution of entry.substitutions) {
              await db
                .insert(Substitutions)
                .values({
                  course: entry.course.id,
                  start: entry.start,
                  substitute: substitution.substitute?.id,
                  type: substitution.type,
                })
                .onConflictDoUpdate({
                  target: [Substitutions.course, Substitutions.start],
                  set: {
                    substitute: substitution.substitute?.id,
                    type: substitution.type,
                  },
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
    absences: {
      listUnexcused: {
        persist: async (_, output) => {
          for (const absenceDay of output) {
            await db
              .insert(AbsenceDays)
              .values({
                date: absenceDay.date,
                reason: absenceDay.reason,
                parentSignature: absenceDay.parentSignature,
              })
              .onConflictDoUpdate({
                target: [AbsenceDays.date],
                set: {
                  reason: absenceDay.reason,
                  parentSignature: absenceDay.parentSignature,
                },
              });

            for (const courseAbsence of absenceDay.absenceCourses) {
              await db
                .insert(CourseAbsences)
                .values({
                  date: absenceDay.date,
                  course: courseAbsence.course.id,
                  teacherSignature: courseAbsence.teacherSignature,
                })
                .onConflictDoUpdate({
                  target: [CourseAbsences.date, CourseAbsences.course],
                  set: {
                    teacherSignature: courseAbsence.teacherSignature,
                  },
                });
            }
          }
        },
      },
      listExcused: {
        persist: async (_, output) => {
          for (const absenceDay of output) {
            await db
              .insert(AbsenceDays)
              .values({
                date: absenceDay.date,
                reason: absenceDay.reason,
                parentSignature: absenceDay.parentSignature,
              })
              .onConflictDoUpdate({
                target: [AbsenceDays.date],
                set: {
                  reason: absenceDay.reason,
                  parentSignature: absenceDay.parentSignature,
                },
              });

            for (const courseAbsence of absenceDay.absenceCourses) {
              await db
                .insert(CourseAbsences)
                .values({
                  date: absenceDay.date,
                  course: courseAbsence.course.id,
                  teacherSignature: courseAbsence.teacherSignature,
                })
                .onConflictDoUpdate({
                  target: [CourseAbsences.date, CourseAbsences.course],
                  set: {
                    teacherSignature: courseAbsence.teacherSignature,
                  },
                });
            }
          }
        },
      },
      getOne: {
        persist: async (input, output) => {
          if (!output) {
            return;
          }

          await db
            .insert(AbsenceDays)
            .values({
              date: input.date,
              reason: output.reason,
              parentSignature: output.parentSignature,
            })
            .onConflictDoUpdate({
              target: [AbsenceDays.date],
              set: {
                reason: output.reason,
                parentSignature: output.parentSignature,
              },
            });

          for (const courseAbsence of output.absenceCourses) {
            await db
              .insert(CourseAbsences)
              .values({
                date: input.date,
                course: courseAbsence.course.id,
                teacherSignature: courseAbsence.teacherSignature,
              })
              .onConflictDoUpdate({
                target: [CourseAbsences.date, CourseAbsences.course],
                set: {
                  teacherSignature: courseAbsence.teacherSignature,
                },
              });
          }
        },
      },
      // add: {
      //   mutate: async (input) => {
      //     const user = getStorage("auth.session")?.user;
      //     if (!user) {
      //       throw new Error("User not logged in");
      //     }

      //     await db.insert(AbsenceDays).values({
      //       date: input.date,
      //       reason: input.reason,
      //       parentSignature: user.isOfAge ? "NOT_REQUIRED" : null,
      //     });
      //     await db.insert(CourseAbsences).values(
      //       input.courseIds.map((courseId) => ({
      //         date: input.date,
      //         course: courseId,
      //       })),
      //     );
      //   },
      // },
      delete: {
        mutate: async (input) => {
          await db
            .delete(CourseAbsences)
            .where(
              and(
                eq(CourseAbsences.date, input.date),
                inArray(CourseAbsences.course, input.courseIds),
              ),
            );

          const courseAbsences = await db.query.CourseAbsences.findMany({
            where: eq(CourseAbsences.date, input.date),
          });

          if (courseAbsences.length === 0) {
            await db
              .delete(AbsenceDays)
              .where(eq(AbsenceDays.date, input.date));
          }
        },
      },
    },
  },
};
