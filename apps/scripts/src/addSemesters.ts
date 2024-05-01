import dayjs from "dayjs";

import { db } from "@schnau/db";
import { getHolidays, State } from "@schnau/external-api";

export const addSemesters = async (state: State) => {
  const holidays = await getHolidays(state);
  const semesterDelimitingHolidays = holidays.filter(
    (holiday) =>
      holiday.name?.toLowerCase().includes("sommerferien") ||
      holiday.name?.toLowerCase().includes("winterferien"),
  );

  if (semesterDelimitingHolidays.length === 0) {
    console.error("Could not find semester delimiting holidays");
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

    const type = start.name?.toLowerCase().includes("sommerferien")
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

  const affectedSchools = await db.school.findMany({
    where: {
      stateCode: state,
    },
  });

  await db.semester.createMany({
    data: affectedSchools.flatMap((school) =>
      semesters.map((semester) => ({
        ...semester,
        schoolId: school.id,
      })),
    ),
    skipDuplicates: true,
  });
};
