import type { DomainEvent } from "@stu/lib";
import { SchoolRepository } from "../repositories/school.repo";
import { PersonRepository } from "../repositories/person.repo";
import { YearRepository } from "../repositories/year.repo";
import { ClassRepository } from "../repositories/class.repo";
import { CourseRepository } from "../repositories/course.repo";
import { HolidayRepository } from "../repositories/holiday.repo";
import { TimetableRepository } from "../repositories/timetable.repo";
import { SemesterRepository } from "../repositories/semester.repo";

import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import type { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/postgres";
import { Effect } from "effect";
import { defaultSchools, studentsOfCourse, studentsOfSchool, studentsOfState, studentsOfYear } from "@stu/lib";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const orgApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "org",
  DatabaseError,
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
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }
      const repo = yield* SchoolRepository;
      if (yield* repo.doesSchoolExist({ id: event.data.id })) {
        return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
      }
    }),
    apply: Effect.fn(function* (event) {
      const repo = yield* SchoolRepository;
      const defaultSchoolValue = defaultSchools[event.data.id];
      yield* repo.createSchool({
        id: event.data.id,
        name: event.data.name,
        stateCode: event.data.state,
        image: defaultSchoolValue.image,
        theme: defaultSchoolValue.theme,
        kadmosName: defaultSchoolValue.kadmosName,
        kadmosUsername: defaultSchoolValue.kadmosUsername,
        kadmosPassword: defaultSchoolValue.kadmosPassword,
      });
    }),
    getEventTopics: (event) => Effect.succeed([studentsOfSchool(event.data.id)]),
  },
  "teacher.joined": {
    verify: Effect.fn(function* (event, { initiatorId }) {
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
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }
      const repo = yield* HolidayRepository;
      if (yield* repo.getHoliday({ name: event.data.name, state: event.data.state, year: event.data.year })) {
        return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
      }
    }),
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
    getEventTopics: (event) => Effect.succeed([studentsOfState(event.data.state)]),
  },
  "year.started": {
    verify: Effect.fn(function* (event, { initiatorId }) {
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
        const classRepo = yield* ClassRepository;

        yield* yearRepo.createYear({
          name: event.data.name,
          startYear: event.data.startYear,
          graduationYear: event.data.graduationYear,
          school: event.data.school,
        });

        for (const cls of event.data.classes) {
          yield* classRepo.createClass({
            identifierInYear: cls.identifierInYear,
            startYear: event.data.startYear,
            school: event.data.school,
            teachers: cls.teachers,
          });
        }
      }),
    getEventTopics: (event) =>
      Effect.succeed([
        studentsOfYear({
          school: event.data.school,
          startYear: event.data.startYear,
        }),
      ]),
  },
  "courses.created": {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }
      const courseRepo = yield* CourseRepository;
      const classRepo = yield* ClassRepository;
      if (yield* courseRepo.getCourse({ id: event.data.id })) {
        return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
      }

      for (const cls of event.data.classes) {
        if (
          yield* classRepo.getClass({
            identifierInYear: cls.identifierInYear,
            startYear: cls.startYear,
            school: event.data.school,
          })
        ) {
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
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== SYSTEM_USER) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }
      const courseRepo = yield* CourseRepository;
      if (yield* courseRepo.getCourse({ id: event.data.course })) {
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
    verify: Effect.fn(function* (event, { initiatorId }) {
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
    verify: Effect.fn(function* (event, { initiatorId }) {
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
    verify: Effect.fn(function* (event, { initiatorId }) {
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
