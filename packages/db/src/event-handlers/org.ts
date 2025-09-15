import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import {
  ClassRepository,
  CourseRepository,
  type DomainEvent,
  HolidayRepository,
  SchoolRepository,
  Semester,
  type SemesterRepository,
  studentsOfCourse,
  studentsOfSchool,
  studentsOfState,
  studentsOfYear,
  type UnknownDatabaseError,
  YearRepository,
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
        const repo = yield* SchoolRepository;
        if (yield* repo.doesSchoolExist({ id: event.data.id })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const repo = yield* SchoolRepository;
        yield* repo.createSchool({
          id: event.data.id,
          name: event.data.name,
          state: event.data.state,
        });
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
        const repo = yield* HolidayRepository;
        if (yield* repo.getHoliday({ name: event.data.name, state: event.data.state, year: event.data.year })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const holidayRepo = yield* HolidayRepository;
        yield* holidayRepo.createHoliday({
          name: event.data.name,
          start: event.data.start,
          end: event.data.end,
          state: event.data.state,
          year: event.data.year,
        });

        yield* Semester.inferSemesters(event.data.state);
      }).pipe(Database.asTransaction),
    getEventTopics: (event) => Effect.succeed([studentsOfState(event.data.state)]),
  },
  "year.started": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
        const repo = yield* YearRepository;
        if (yield* repo.getYear({ school: event.data.school, startYear: event.data.startYear })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const yearRepo = yield* YearRepository;
        yield* yearRepo.createYear({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
          classes: event.data.classes,
        });
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
        const courseRepo = yield* CourseRepository;
        const classRepo = yield* ClassRepository;
        if (yield* courseRepo.getCourse({ id: event.data.id })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }

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
      Effect.gen(function* () {
        const courseRepo = yield* CourseRepository;

        yield* courseRepo.createCourse({
          id: event.data.id,
          name: event.data.name,
          subject: event.data.subject,
          school: event.data.school,
          semester: event.data.semester,
          isMandatory: event.data.isMandatory,
          teachers: event.data.teachers,
          classes: event.data.classes,
        });
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
