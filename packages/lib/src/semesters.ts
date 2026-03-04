import { addDays } from "date-fns/fp";
import { DateTime, Effect, ServiceMap, pipe } from "effect";
import { dateToSimpleDate, type SimpleDate, simpleDateToDate } from "./infrastructure/dates";
import { HolidayRepository, SchoolRepository, type UnknownDatabaseError } from "./repositories";
import type { SchoolId, StateCode } from "./school";
import type { Year } from "./year";

export interface Semester {
  name: string;
  start: SimpleDate;
  end: SimpleDate;
  type: Semester.Type;
  year: number;
  school: SchoolId;
}

export namespace Semester {
  export const current = Effect.gen(function* () {
    // TODO: Don't hardcode school id
    const school = "igs-lil";
    const now = yield* DateTime.now;
    const today = DateTime.toDate(now);
    const repo = yield* SemesterRepository;

    const semester = yield* repo.getSemesterOnDate(today, school);
    if (semester) return semester;

    const nextSemester = yield* repo.getNextSemesterAfterDate(today, school);
    if (nextSemester) return nextSemester;

    return yield* repo.getLatestSemester(school);
  });

  export type Type = "SUMMER" | "WINTER";
  export interface Id {
    type: Semester.Type;
    year: number;
  }

  export const inferSemesters = Effect.fn(function* (state: StateCode) {
    const semesterRepo = yield* SemesterRepository;
    const holidayRepo = yield* HolidayRepository;
    const schoolRepo = yield* SchoolRepository;

    const allHolidays = yield* holidayRepo.getAllHolidays(); // TODO: filter by state

    const semesterDelimitingHolidays = allHolidays.filter(
      (holiday) =>
        holiday.name.toLowerCase().includes("sommerferien") ||
        holiday.name.toLowerCase().includes("winterferien") ||
        holiday.name.toLowerCase().includes("halbjahresferien"),
    );

    if (semesterDelimitingHolidays.length < 2) {
      return;
    }

    const semesters: {
      start: SimpleDate;
      end: SimpleDate;
      name: string;
      type: "WINTER" | "SUMMER";
      year: number;
    }[] = [];

    for (let i = 0; i < semesterDelimitingHolidays.length - 1; i++) {
      const start = semesterDelimitingHolidays[i];
      const end = semesterDelimitingHolidays[i + 1];

      if (!start || !end) throw new Error("Start or end holidays are undfined"); // TODO: Effect.fail

      const type = start.name.toLowerCase().includes("sommerferien") ? "WINTER" : "SUMMER";

      const formattedYearRange = start.year === end.year ? start.year : `${start.year}/${end.year}`;
      const formattedType = type === "WINTER" ? "Winter" : "Sommer";
      const name = `${formattedType} ${formattedYearRange}`;

      semesters.push({
        start: pipe(start.end, simpleDateToDate, addDays(1), dateToSimpleDate),
        end: pipe(end.start, simpleDateToDate, addDays(-1), dateToSimpleDate),
        name,
        type,
        year: start.year,
      });
    }

    const affectedSchools = yield* schoolRepo.getSchoolsByState({ state });

    yield* semesterRepo.createSemesters(
      affectedSchools.flatMap((school) =>
        semesters.map((semester) => ({
          ...semester,
          school: school.id,
        })),
      ),
    );
  });
}

export class SemesterRepository extends ServiceMap.Service<
  SemesterRepository,
  {
    createSemesters: (
      payload: {
        name: string;
        start: SimpleDate;
        end: SimpleDate;
        type: Semester.Type;
        year: number;
        school: SchoolId;
      }[],
    ) => Effect.Effect<void, UnknownDatabaseError>;

    getSemesterOnDate: (date: Date, school: SchoolId) => Effect.Effect<Semester | undefined, UnknownDatabaseError>;

    getNextSemesterAfterDate: (
      date: Date,
      school: SchoolId,
    ) => Effect.Effect<Semester | undefined, UnknownDatabaseError>;

    getLatestSemester: (school: SchoolId) => Effect.Effect<Semester | undefined, UnknownDatabaseError>;

    semestersInYear: (year: Year) => Effect.Effect<Semester[], UnknownDatabaseError>;
  }
>()("SemesterRepository") {}
