import { and, eq } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";
import {
  defaultSchools,
  studentsOfCourse,
  studentsOfSchool,
  studentsOfState,
  studentsOfYear,
} from "@stu/lib";

import { db } from "../client";
import * as tables from "../schema";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const orgApplicators: NamespaceEventApplicators<"org", unknown> = {
  "school.founded": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const school = await db.query.Schools.findFirst({
        where: eq(tables.Schools.id, data.id),
      });

      if (school) return "EXISTS";
    },
    apply: async ({ data }) => {
      const defaultSchoolValue = defaultSchools[data.id];
      await db.insert(tables.Schools).values({
        id: data.id,
        name: data.name,
        stateCode: data.state,
        image: defaultSchoolValue.image,
        theme: defaultSchoolValue.theme,
        kadmosName: defaultSchoolValue.kadmosName,
        kadmosUsername: defaultSchoolValue.kadmosUsername,
        kadmosPassword: defaultSchoolValue.kadmosPassword,
      });
    },
    topics: ({ data }) => [studentsOfSchool(data.id)],
  },
  "teacher.joined": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const person = await db.query.Persons.findFirst({
        where: eq(tables.Persons.abbrv, data.abbrv),
      });

      if (person) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.Persons).values({
        id: data.personId,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        salutation: data.salutation,
        abbrv: data.abbrv,
      });
    },
    topics: ({ data }) => [studentsOfSchool(data.school)],
  },
  "holiday.created": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const holiday = await db.query.holidays.findFirst({
        where: and(
          eq(tables.holidays.name, data.name),
          eq(tables.holidays.start, data.start),
          eq(tables.holidays.end, data.end),
          eq(tables.holidays.state, data.state),
          eq(tables.holidays.year, data.year),
        ),
      });

      if (holiday) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.holidays).values({
        name: data.name,
        start: data.start,
        end: data.end,
        state: data.state,
        year: data.year,
      });

      const allHolidays = await db.query.holidays.findMany();
      const semesterDelimitingHolidays = allHolidays.filter(
        (holiday) =>
          holiday.name.toLowerCase().includes("sommerferien") ||
          holiday.name.toLowerCase().includes("winterferien"),
      );

      if (semesterDelimitingHolidays.length < 2) {
        return;
      }

      const semesters: {
        start: Date;
        end: Date;
        name: string;
        type: "WINTER" | "SUMMER";
        year: number;
      }[] = [];

      for (let i = 0; i < semesterDelimitingHolidays.length - 1; i++) {
        const start = semesterDelimitingHolidays[i];
        const end = semesterDelimitingHolidays[i + 1];

        if (!start || !end)
          throw new Error("Start or end holidays are undfined");

        const type = start.name.toLowerCase().includes("sommerferien")
          ? "WINTER"
          : "SUMMER";

        const formattedYearRange =
          start.year === end.year ? start.year : `${start.year}/${end.year}`;
        const formattedType = type === "WINTER" ? "Winter" : "Sommer";
        const name = `${formattedType} ${formattedYearRange}`;

        semesters.push({
          start: start.end,
          end: end.start,
          name,
          type,
          year: start.year,
        });
      }

      const affectedSchools = await db.query.Schools.findMany({
        where: eq(tables.Schools.stateCode, data.state),
      });

      await db
        .insert(tables.Semesters)
        .values(
          affectedSchools.flatMap((school) =>
            semesters.map((semester) => ({
              ...semester,
              school: school.id,
            })),
          ),
        )
        .onConflictDoNothing()
        .execute();
    },
    topics: ({ data }) => [studentsOfState(data.state)],
  },
  "year.started": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const year = await db.query.Years.findFirst({
        where: and(
          eq(tables.Years.startYear, data.startYear),
          eq(tables.Years.school, data.school),
        ),
      });

      if (year) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.Years).values({
        name: data.name,
        startYear: data.startYear,
        graduationYear: data.graduationYear,
        school: data.school,
      });

      for (const cls of data.classes) {
        await db.insert(tables.Classes).values({
          identifierInYear: cls.identifierInYear,
          startYear: data.startYear,
          school: data.school,
        });

        for (const teacher of cls.teachers) {
          await db.insert(tables.TeachersToClasses).values({
            teacher,
            classIdentifier: cls.identifierInYear,
            classStartYear: data.startYear,
            school: data.school,
          });
        }
      }
    },
    topics: ({ data }) => [
      studentsOfYear({
        school: data.school,
        startYear: data.startYear,
      }),
    ],
  },
  "courses.created": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const course = await db.query.Courses.findFirst({
        where: and(
          eq(tables.Courses.id, data.id),
          eq(tables.Courses.school, data.school),
        ),
      });
      if (course) return "EXISTS";

      for (const clsData of data.classes) {
        const cls = await db.query.Classes.findFirst({
          where: and(
            eq(tables.Classes.school, data.school),
            eq(tables.Classes.identifierInYear, clsData.identifierInYear),
            eq(tables.Classes.startYear, clsData.startYear),
          ),
        });

        if (!cls) return "CLASS_NOT_FOUND";
      }
    },
    apply: async ({ data }) => {
      await db.insert(tables.Courses).values({
        id: data.id,
        name: data.name,
        subject: data.subject,
        school: data.school,
        semesterType: data.semester.type,
        semesterYear: data.semester.year,
        isMandatory: data.isMandatory,
      });

      for (const teacher of data.teachers) {
        await db.insert(tables.CoursesToTeachers).values({
          course: data.id,
          teacher,
        });
      }

      for (const cls of data.classes) {
        await db.insert(tables.CoursesToClasses).values({
          course: data.id,
          classIdentifier: cls.identifierInYear,
          classStartYear: cls.startYear,
          school: data.school,
        });
      }
    },
    topics: ({ data }) => [studentsOfCourse(data.id)],
  },
  "timetable.entryCreated": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const course = await db.query.Courses.findFirst({
        where: and(eq(tables.Courses.id, data.course)),
      });

      if (!course) return "COURSE_NOT_FOUND";
    },
    apply: async ({ data }) => {
      const existingTimetableEntry = await db.query.TimetableEntries.findFirst({
        where: and(
          eq(tables.TimetableEntries.course, data.course),
          eq(tables.TimetableEntries.start, data.start),
        ),
      });

      await db
        .insert(tables.TimetableEntries)
        .values({
          start: data.start,
          duration: data.duration,
          course: data.course,
          rooms: data.rooms,
        })
        .onConflictDoUpdate({
          target: [
            tables.TimetableEntries.start,
            tables.TimetableEntries.course,
          ],
          set: {
            // TODO: We might want to overwrite these values
            duration: Math.max(
              existingTimetableEntry?.duration ?? 0,
              data.duration,
            ),
            rooms: [
              ...new Set([
                ...data.rooms,
                ...(existingTimetableEntry?.rooms ?? []),
              ]),
            ],
          },
        });
    },
    topics: ({ data }) => [studentsOfCourse(data.course)],
  },
  "timetable.substituted": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const existingSubstitution = await db.query.Substitutions.findFirst({
        where: and(
          eq(tables.Substitutions.start, data.start),
          eq(tables.Substitutions.course, data.course),
          eq(tables.Substitutions.originalTeacher, data.originalTeacher),
        ),
      });

      if (existingSubstitution) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.Substitutions).values({
        course: data.course,
        start: data.start,
        originalTeacher: data.originalTeacher,
        substitute: data.substitute,
        updatedAt: new Date(),
        type: "VERTRETUNG",
      });
    },
    topics: ({ data }) => [studentsOfCourse(data.course)],
  },
  "timetable.canceled": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const existingSubstitution = await db.query.Substitutions.findFirst({
        where: and(
          eq(tables.Substitutions.start, data.start),
          eq(tables.Substitutions.course, data.course),
          eq(tables.Substitutions.originalTeacher, data.originalTeacher),
        ),
      });

      if (existingSubstitution) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.Substitutions).values({
        start: data.start,
        course: data.course,
        originalTeacher: data.originalTeacher,
        substitute: null,
        updatedAt: new Date(),
        type: "ENTFALL",
      });
    },
    topics: ({ data }) => [studentsOfCourse(data.course)],
  },
  "timetable.discarded": {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const existingTimetableEntry = await db.query.TimetableEntries.findFirst({
        where: and(
          eq(tables.TimetableEntries.course, data.course),
          eq(tables.TimetableEntries.start, data.start),
        ),
      });

      if (!existingTimetableEntry) return "DOES_NOT_EXIST";
    },
    apply: async ({ data }) => {
      await db
        .delete(tables.TimetableEntries)
        .where(
          and(
            eq(tables.TimetableEntries.course, data.course),
            eq(tables.TimetableEntries.start, data.start),
          ),
        );
    },
    topics: ({ data }) => [studentsOfCourse(data.course)],
  },
};
