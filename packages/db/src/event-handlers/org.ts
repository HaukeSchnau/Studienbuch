import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import {
  applyOrgCoursesCreated,
  applyOrgHolidayCreated,
  applyOrgSchoolFounded,
  applyOrgYearStarted,
  ClassRepository,
  CourseRepository,
  type DomainEvent,
  type HolidayRepository,
  type SchoolRepository,
  type SemesterRepository,
  studentsOfCourse,
  studentsOfSchool,
  studentsOfState,
  studentsOfYear,
  type UnknownDatabaseError,
  verifyOrgCoursesCreated,
  verifyOrgHolidayCreated,
  verifyOrgSchoolFounded,
  verifyOrgYearStarted,
  type YearRepository,
} from "@stu/lib";
import { Effect } from "effect";
import { Database } from "../database";
import { PersonRepository } from "../repositories/person.repo";
import { TimetableRepository } from "../repositories/timetable.repo";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const orgApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "org",
  UnknownDatabaseError,
  | Database
  | SchoolRepository
  | PersonRepository
  | YearRepository
  | ClassRepository
  | CourseRepository
  | HolidayRepository
  | TimetableRepository
  | SemesterRepository
> = {
  "school.founded": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        yield* verifyOrgSchoolFounded({
          data: event.data,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });
      }),
    apply: (event) =>
      applyOrgSchoolFounded({
        data: event.data,
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfSchool(event.data.id)]),
  },
  "teacher.joined": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        const repo = yield* PersonRepository;
        if (yield* repo.getPersonByAbbrv({ abbrv: event.data.abbrv })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      PersonRepository.use((repo) =>
        repo.createPerson({
          id: event.data.personId,
          firstName: event.data.firstName ?? "",
          lastName: event.data.lastName ?? "",
          salutation: event.data.salutation,
          abbrv: event.data.abbrv,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfSchool(event.data.school)]),
  },
  "holiday.created": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        yield* verifyOrgHolidayCreated({
          data: event.data,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });
      }),
    apply: (event) =>
      applyOrgHolidayCreated({
        data: event.data,
      }).pipe(Database.asTransaction),
    getEventTopics: (event) => Effect.succeed([studentsOfState(event.data.state)]),
  },
  "year.started": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        yield* verifyOrgYearStarted({
          data: event.data,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });
      }),
    apply: (event) =>
      applyOrgYearStarted({
        data: event.data,
      }).pipe(Database.asTransaction),
    getEventTopics: (event) =>
      Effect.succeed([
        studentsOfYear({
          school: event.data.school,
          startYear: event.data.startYear,
        }),
      ]),
  },
  "courses.created": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        yield* verifyOrgCoursesCreated({
          data: event.data,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });

        const classRepo = yield* ClassRepository;

        for (const cls of event.data.classes) {
          const existingClass = yield* classRepo.getClass({
            identifier: cls.identifierInYear,
            startYear: cls.startYear,
            school: event.data.school,
          });
          if (!existingClass) {
            return yield* Effect.fail(new ValidationError({ cause: "CLASS_NOT_FOUND", reason: "NOT_FOUND" }));
          }
        }
      }),
    apply: (event) =>
      applyOrgCoursesCreated({
        data: event.data,
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.id)]),
  },
  "timetable.entryCreated": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        const courseRepo = yield* CourseRepository;
        const existingCourse = yield* courseRepo.getCourse({ id: event.data.course });
        if (!existingCourse) {
          return yield* Effect.fail(new ValidationError({ cause: "COURSE_NOT_FOUND", reason: "NOT_FOUND" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* TimetableRepository;
        yield* timetableRepo.upsertTimetableEntry({
          course: event.data.course,
          start: event.data.start,
          duration: event.data.duration,
          rooms: event.data.rooms,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
  "timetable.substituted": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        const timetableRepo = yield* TimetableRepository;
        if (
          yield* timetableRepo.getSubstitution({
            course: event.data.course,
            start: event.data.start,
            originalTeacher: event.data.originalTeacher,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* TimetableRepository;
        yield* timetableRepo.createSubstitution({
          course: event.data.course,
          start: event.data.start,
          originalTeacher: event.data.originalTeacher,
          substitute: event.data.substitute,
          type: "VERTRETUNG",
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
  "timetable.canceled": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        const timetableRepo = yield* TimetableRepository;
        if (
          yield* timetableRepo.getSubstitution({
            course: event.data.course,
            start: event.data.start,
            originalTeacher: event.data.originalTeacher,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* TimetableRepository;
        yield* timetableRepo.createSubstitution({
          course: event.data.course,
          start: event.data.start,
          originalTeacher: event.data.originalTeacher,
          type: "ENTFALL",
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
  "timetable.discarded": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        const timetableRepo = yield* TimetableRepository;
        if (
          yield* timetableRepo.getTimetableEntry({
            course: event.data.course,
            start: event.data.start,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "DOES_NOT_EXIST", reason: "NOT_FOUND" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const timetableRepo = yield* TimetableRepository;
        yield* timetableRepo.deleteTimetableEntry({
          course: event.data.course,
          start: event.data.start,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
  },
};
