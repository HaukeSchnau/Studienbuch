import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";

import type { Extra } from "./types";
import * as tables from "../schema";

// @ts-expect-error TODO: fill handler
export const orgApplicators: NamespaceEventApplicators<"org", Extra> = {
  "school.founded": {
    verify: () => Promise.resolve(true),
    apply: async ({ data }, { db }) => {
      await db.insert(tables.schools).values({
        id: data.id,
        name: data.name,
        stateCode: data.state,
      });
    },
  },
  "teacher.joined": {
    verify: () => Promise.resolve(true),
    apply: async ({ data }, { db }) => {
      await db.insert(tables.persons).values({
        id: data.personId,
        name: data.name,
        salutation: data.salutation,
        abbrv: data.abbrv,
      });
    },
  },
  "holiday.created": {
    verify: () => Promise.resolve(true),
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

      console.log(semesters);
      console.log(affectedSchools);

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

  //   "year.started": {
  //     verify: () => Promise.resolve(true),
  //     apply: async ({ data }, { db }) => {
  //       await db.insert(tables.years).values({
  //         id: data.id,
  //         name: data.name,
  //         startYear: data.start_year,
  //         graduationYear: data.graduation_year,
  //         school: data.school,
  //       });
  //     },
  //   }
};
