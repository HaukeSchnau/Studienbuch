import dayjs from "dayjs";

import type { State } from "@stu/external-api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools, Semesters } from "@stu/db/schema";
import { getHolidays } from "@stu/external-api";

import { logger } from "../logger";

export const addSemesters = async (state: State) => {
  const holidays = await getHolidays(state);
  const semesterDelimitingHolidays = holidays.filter(
    (holiday) =>
      holiday.name.toLowerCase().includes("sommerferien") ||
      holiday.name.toLowerCase().includes("winterferien"),
  );

  if (semesterDelimitingHolidays.length === 0) {
    logger.error("Could not find semester delimiting holidays");
    process.exit(1);
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

    if (!start || !end) throw new Error("Start or end holidays are undfined");

    const type = start.name.toLowerCase().includes("sommerferien")
      ? "WINTER"
      : "SUMMER";

    const formattedYearRange =
      start.year === end.year ? start.year : `${start.year}/${end.year}`;
    const formattedType = type === "WINTER" ? "Winter" : "Sommer";
    const name = `${formattedType} ${formattedYearRange}`;

    semesters.push({
      start: dayjs(start.end).toDate(),
      end: dayjs(end.start).toDate(),
      name,
      type,
      year: start.year,
    });
  }

  const affectedSchools = await db.query.Schools.findMany({
    where: eq(Schools.stateCode, state),
  });

  await db
    .insert(Semesters)
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
};
