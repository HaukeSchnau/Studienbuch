import { type NamespaceApplicatorMap, ValidationError } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import {
  applyOrgCoursesCreated,
  applyOrgHolidayCreated,
  applyOrgSchoolFounded,
  applyOrgYearStarted,
  type CourseRepository,
  type HolidayRepository,
  PersonRepository,
  type SchoolRepository,
  type SemesterRepository,
  TimetableRepository,
  verifyOrgCoursesCreated,
  verifyOrgHolidayCreated,
  verifyOrgSchoolFounded,
  verifyOrgYearStarted,
  type YearRepository,
} from "@stu/lib";
import { Effect } from "effect";

const failIfTrue = (message: string, reason: "DUPLICATE" | "NOT_FOUND" | "NOT_ALLOWED" | "INVALID" | "UNKNOWN") =>
  Effect.flatMap((bool) => (bool ? Effect.fail(new ValidationError({ cause: message, reason })) : Effect.void));

export const orgApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "org",
  DatabaseError<GenericSqliteError>,
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
      verifyOrgSchoolFounded({
        data: event.data,
        onDuplicate: () => new ValidationError({ cause: "School already exists", reason: "DUPLICATE" }),
      }),
    apply: (event) =>
      applyOrgSchoolFounded({
        data: event.data,
      }),
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
      verifyOrgHolidayCreated({
        data: event.data,
        onDuplicate: () => new ValidationError({ cause: "Holiday already exists", reason: "DUPLICATE" }),
      }),
    apply: (event) =>
      applyOrgHolidayCreated({
        data: event.data,
      }),
  },
  "year.started": {
    verify: (event) =>
      verifyOrgYearStarted({
        data: event.data,
        onDuplicate: () => new ValidationError({ cause: "Year already exists", reason: "DUPLICATE" }),
      }),
    apply: (event) =>
      applyOrgYearStarted({
        data: event.data,
      }),
  },
  "courses.created": {
    verify: (event) =>
      verifyOrgCoursesCreated({
        data: event.data,
        onDuplicate: () => new ValidationError({ cause: "Course already exists", reason: "DUPLICATE" }),
      }),
    apply: (event) =>
      applyOrgCoursesCreated({
        data: event.data,
      }),
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
