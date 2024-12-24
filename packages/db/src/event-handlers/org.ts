import { eq } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";
import { defaultSchools } from "@stu/lib";

import { db } from "../client";
import * as tables from "../schema";

export const orgApplicators: NamespaceEventApplicators<"org", unknown> = {
  "school.founded": {
    verify: async ({ data }) => {
      const school = await db.query.Schools.findFirst({
        where: eq(tables.Schools.id, data.id),
      });

      if (school) {
        return "EXISTS";
      }
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
  },
  "teacher.joined": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }) => {
      await db.insert(tables.Persons).values({
        id: data.personId,
        name: data.name,
        salutation: data.salutation,
        abbrv: data.abbrv,
      });
    },
  },
  "holiday.created": {
    verify: () => Promise.resolve(undefined),
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

      console.log(semesters);
      console.log(affectedSchools);

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
  },
  "year.started": {
    verify: () => Promise.resolve(undefined),
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
  },
  "courses.created": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }) => {
      await db.insert(tables.Courses).values({
        id: data.id,
        name: data.name,
        longName: data.longName,
        subject: data.subject,
        school: data.school,
        semesterType: data.semesterType,
        semesterYear: data.semesterYear,
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
  },
  "timetable.entryCreated": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }) => {
      await db.insert(tables.TimetableEntries).values({
        start: data.start,
        duration: data.duration,
        course: data.course,
      });

      for (const room of data.rooms) {
        await db.insert(tables.TimetableEntryRooms).values({
          start: data.start,
          course: data.course,
          roomNumber: room,
        });
      }
    },
  },
  "timetable.substituted": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }) => {
      await db.insert(tables.Substitutions).values({
        course: data.course,
        start: data.start,
        substitute: data.substitute,
        updatedAt: new Date(),
        type: "VERTRETUNG",
      });
    },
  },
  "timetable.canceled": {
    verify: () => Promise.resolve(undefined),
    apply: async ({ data }) => {
      await db.insert(tables.Substitutions).values({
        start: data.start,
        course: data.course,
        substitute: null,
        updatedAt: new Date(),
        type: "ENTFALL",
      });
    },
  },
};
