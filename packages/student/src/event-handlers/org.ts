import { type NamespaceApplicatorMap, ValidationError } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import {
  CourseRepository,
  HolidayRepository,
  PersonRepository,
  SchoolRepository,
  SemesterRepository,
  TimetableRepository,
  YearRepository,
} from "@stu/lib";
import { Effect } from "effect";
import type { Database } from "../database";

const failIfTrue = (message: string, reason: "DUPLICATE" | "NOT_FOUND" | "NOT_ALLOWED" | "INVALID" | "UNKNOWN") =>
  Effect.flatMap((bool) => (bool ? Effect.fail(new ValidationError({ cause: message, reason })) : Effect.void));

export const orgApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "org",
  DatabaseError<GenericSqliteError>,
  | Database
  | SchoolRepository
  | PersonRepository
  | YearRepository
  | CourseRepository
  | TimetableRepository
  | HolidayRepository
  | SemesterRepository
> = {
  "school.founded": {
    verify: (event) =>
      Effect.andThen(SchoolRepository, (repo) =>
        repo.doesSchoolExist({
          id: event.data.id,
        }),
      ).pipe(failIfTrue("School already exists", "DUPLICATE")),
    apply: (event) =>
      Effect.andThen(SchoolRepository, (repo) =>
        repo.createSchool({
          id: event.data.id,
          name: event.data.name,
          state: event.data.state,
        }),
      ),
  },
  "teacher.joined": {
    verify: (event) =>
      Effect.andThen(PersonRepository, (repo) =>
        repo.doesTeacherExist({
          id: event.data.personId,
        }),
      ).pipe(failIfTrue("Teacher already exists", "DUPLICATE")),
    apply: (event) =>
      Effect.andThen(PersonRepository, (repo) =>
        repo.createTeacher({
          personId: event.data.personId,
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          salutation: event.data.salutation,
          abbrv: event.data.abbrv,
        }),
      ),
  },
  "holiday.created": {
    verify: (event) =>
      Effect.andThen(HolidayRepository, (repo) =>
        repo.doesHolidayExist({
          name: event.data.name,
          start: event.data.start,
          end: event.data.end,
          state: event.data.state,
          year: event.data.year,
        }),
      ).pipe(failIfTrue("Holiday already exists", "DUPLICATE")),
    apply: Effect.fn(function* (event) {
      const holidayRepo = yield* HolidayRepository;
      const semesterRepo = yield* SemesterRepository;
      const schoolRepo = yield* SchoolRepository;
      yield* holidayRepo.createHoliday({
        name: event.data.name,
        start: event.data.start,
        end: event.data.end,
        state: event.data.state,
        year: event.data.year,
      });

      const allHolidays = yield* holidayRepo.getAllHolidays();

      const semesterDelimitingHolidays = allHolidays.filter(
        (holiday) =>
          holiday.name.toLowerCase().includes("sommerferien") || holiday.name.toLowerCase().includes("winterferien"),
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

        if (!start || !end) throw new Error("Start or end holidays are undfined"); // TODO: Effect.fail

        const type = start.name.toLowerCase().includes("sommerferien") ? "WINTER" : "SUMMER";

        const formattedYearRange = start.year === end.year ? start.year : `${start.year}/${end.year}`;
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

      const affectedSchools = yield* schoolRepo.getSchoolsByState({ state: event.data.state });

      yield* semesterRepo.createSemesters(
        affectedSchools.flatMap((school) =>
          semesters.map((semester) => ({
            ...semester,
            school: school.id,
          })),
        ),
      );
    }),
  },
  "year.started": {
    verify: (event) =>
      Effect.andThen(YearRepository, (repo) =>
        repo.doesYearExist({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
        }),
      ).pipe(failIfTrue("Year already exists", "DUPLICATE")),
    apply: (event) =>
      Effect.andThen(YearRepository, (repo) =>
        repo.createYear({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
          classes: event.data.classes,
        }),
      ),
  },
  "courses.created": {
    verify: (event) =>
      Effect.andThen(CourseRepository, (repo) =>
        repo.doesCourseExist({
          id: event.data.id,
        }),
      ).pipe(failIfTrue("Course already exists", "DUPLICATE")),
    apply: (event) =>
      Effect.andThen(CourseRepository, (repo) =>
        repo.createCourse({
          id: event.data.id,
          name: event.data.name,
          subject: event.data.subject,
          school: event.data.school,
          semester: event.data.semester,
          isMandatory: event.data.isMandatory,
          teachers: event.data.teachers,
          classes: event.data.classes,
        }),
      ),
  },
  "timetable.entryCreated": {
    verify: (event) =>
      Effect.andThen(TimetableRepository, (repo) =>
        repo.doesTimetableEntryExist({
          start: event.data.start,
          course: event.data.course,
        }),
      ).pipe(failIfTrue("Timetable entry already exists", "DUPLICATE")),
    apply: (event) =>
      Effect.andThen(TimetableRepository, (repo) =>
        repo.createTimetableEntry({
          start: event.data.start,
          duration: event.data.duration,
          course: event.data.course,
          rooms: event.data.rooms,
        }),
      ),
  },
  "timetable.substituted": {
    verify: () => Effect.void,
    apply: (event) =>
      Effect.andThen(TimetableRepository, (repo) =>
        repo.createSubstitution({
          start: event.data.start,
          course: event.data.course,
          substitute: event.data.substitute,
          type: "VERTRETUNG",
        }),
      ),
  },

  "timetable.canceled": {
    verify: () => Effect.void,
    apply: (event) =>
      Effect.andThen(TimetableRepository, (repo) =>
        repo.createSubstitution({
          start: event.data.start,
          course: event.data.course,
          substitute: null,
          type: "ENTFALL",
        }),
      ),
  },

  "timetable.discarded": {
    verify: () => Effect.void,
    apply: (event) =>
      Effect.andThen(TimetableRepository, (repo) =>
        repo.deleteTimetableEntry({
          start: event.data.start,
          course: event.data.course,
        }),
      ),
  },
};
