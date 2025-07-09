import { and, eq } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";

import * as tables from "../schema";
import type { Extra } from "./types";

export const orgApplicators: NamespaceEventApplicators<"org", Extra> = {
  "school.founded": {
    verify: async ({ data }, { db }) => {
      const school = await db.query.schools.findFirst({
        where: eq(tables.schools.id, data.id),
      });

      if (school) {
        return "EXISTS";
      }
    },
    apply: async ({ data }, { db }) => {
      await db.insert(tables.schools).values({
        id: data.id,
        name: data.name,
        stateCode: data.state,
      });
    },
  },
  "teacher.joined": {
    verify: async ({ data }, { db }) => {
      const person = await db.query.persons.findFirst({
        where: eq(tables.persons.id, data.personId),
      });

      if (person) {
        return "EXISTS";
      }
    },
    apply: async ({ data }, { db }) => {
      await db.insert(tables.persons).values({
        id: data.personId,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        salutation: data.salutation,
        abbrv: data.abbrv,
      });
    },
  },
  "holiday.created": {
    verify: async ({ data }, { db }) => {
      const holiday = await db.query.holidays.findFirst({
        where: eq(tables.holidays.name, data.name),
      });

      if (holiday) {
        return "EXISTS";
      }
    },
    apply: async ({ data }, { db }) => {
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

      const affectedSchools = await db.query.schools.findMany({
        where: eq(tables.schools.stateCode, data.state),
      });

      await db
        .insert(tables.semesters)
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
  },
  "year.started": {
    verify: async ({ data }, { db }) => {
      const year = await db.query.years.findFirst({
        where: and(
          eq(tables.years.startYear, data.startYear),
          eq(tables.years.school, data.school),
        ),
      });

      if (year) {
        return "EXISTS";
      }
    },
    apply: async ({ data }, { db }) => {
      await db.insert(tables.years).values({
        name: data.name,
        startYear: data.startYear,
        graduationYear: data.graduationYear,
        school: data.school,
      });

      for (const cls of data.classes) {
        await db.insert(tables.classes).values({
          identifierInYear: cls.identifierInYear,
          startYear: data.startYear,
          school: data.school,
        });

        for (const teacher of cls.teachers) {
          await db.insert(tables.teachersToClasses).values({
            teacher,
            classIdentifier: cls.identifierInYear,
            classStartYear: data.startYear,
            school: data.school,
          });
        }
      }
    },
  },
  "courses.created": {
    verify: async ({ data }, { db }) => {
      const course = await db.query.courses.findFirst({
        where: eq(tables.courses.id, data.id),
      });

      if (course) {
        return "EXISTS";
      }
    },
    apply: async ({ data }, { db }) => {
      await db.insert(tables.courses).values({
        id: data.id,
        name: data.name,
        subject: data.subject,
        school: data.school,
        semesterType: data.semester.type,
        semesterYear: data.semester.year,
        isMandatory: data.isMandatory,
        isMember: false,
      });

      for (const teacher of data.teachers) {
        await db.insert(tables.coursesToTeachers).values({
          course: data.id,
          teacher,
        });
      }

      for (const cls of data.classes) {
        await db.insert(tables.coursesToClasses).values({
          course: data.id,
          classIdentifier: cls.identifierInYear,
          classStartYear: cls.startYear,
          school: data.school,
        });
      }
    },
  },
  "timetable.entryCreated": {
    verify: async ({ data }, { db }) => {
      const timetableEntry = await db.query.timetableEntries.findFirst({
        where: and(
          eq(tables.timetableEntries.course, data.course),
          eq(tables.timetableEntries.start, data.start),
        ),
      });

      if (timetableEntry) {
        return "EXISTS";
      }
    },
    apply: async ({ data }, { db }) => {
      await db.insert(tables.timetableEntries).values({
        start: data.start,
        duration: data.duration,
        course: data.course,
      });

      for (const room of data.rooms) {
        await db.insert(tables.timetableEntryRooms).values({
          start: data.start,
          course: data.course,
          roomNumber: room,
        });
      }
    },
  },
  "timetable.substituted": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }, { db }) => {
      await db.insert(tables.substitutions).values({
        start: data.start,
        course: data.course,
        substitute: data.substitute,
        type: "VERTRETUNG",
      });
    },
  },
  "timetable.canceled": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }, { db }) => {
      await db.insert(tables.substitutions).values({
        start: data.start,
        course: data.course,
        substitute: null,
        type: "ENTFALL",
      });
    },
  },
  "timetable.discarded": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }, { db }) => {
      await db
        .delete(tables.timetableEntries)
        .where(
          and(
            eq(tables.timetableEntries.course, data.course),
            eq(tables.timetableEntries.start, data.start),
          ),
        );
    },
  },
};
