import { type NamespaceApplicatorMap, ValidationError } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import { Effect } from "effect";
import type { Database } from "../database";
import { CourseRepository } from "../repositories/course.repo";
import { HolidayRepository } from "../repositories/holiday.repo";
import { PersonRepository } from "../repositories/person.repo";
import { SchoolRepository } from "../repositories/school.repo";
import { SemesterRepository } from "../repositories/semester.repo";
import { TimetableRepository } from "../repositories/timetable.repo";
import { YearRepository } from "../repositories/year.repo";

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
      SchoolRepository.use((repo) =>
        repo.doesSchoolExist({
          id: event.data.id,
        }),
      ).pipe(failIfTrue("School already exists", "DUPLICATE")),
    apply: (event) =>
      SchoolRepository.use((repo) =>
        repo.createSchool({
          id: event.data.id,
          name: event.data.name,
          state: event.data.state,
        }),
      ),
  },
  "teacher.joined": {
    verify: (event) =>
      PersonRepository.use((repo) =>
        repo.doesTeacherExist({
          id: event.data.personId,
        }),
      ).pipe(failIfTrue("Teacher already exists", "DUPLICATE")),
    apply: (event) =>
      PersonRepository.use((repo) =>
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
      HolidayRepository.use((repo) =>
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
      YearRepository.use((repo) =>
        repo.doesYearExist({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
        }),
      ).pipe(failIfTrue("Year already exists", "DUPLICATE")),
    apply: (event) =>
      YearRepository.use((repo) =>
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
      CourseRepository.use((repo) =>
        repo.doesCourseExist({
          id: event.data.id,
        }),
      ).pipe(failIfTrue("Course already exists", "DUPLICATE")),
    apply: (event) =>
      CourseRepository.use((repo) =>
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
      TimetableRepository.use((repo) =>
        repo.doesTimetableEntryExist({
          start: event.data.start,
          course: event.data.course,
        }),
      ).pipe(failIfTrue("Timetable entry already exists", "DUPLICATE")),
    apply: (event) =>
      TimetableRepository.use((repo) =>
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
      TimetableRepository.use((repo) =>
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
      TimetableRepository.use((repo) =>
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
      TimetableRepository.use((repo) =>
        repo.deleteTimetableEntry({
          start: event.data.start,
          course: event.data.course,
        }),
      ),
  },
};
