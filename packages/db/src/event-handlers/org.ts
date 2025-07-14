import type { DomainEvent } from "@stu/lib";
import { OrgRepository } from "./org.repo";

import type { NamespaceApplicatorMap, NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import type { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/postgres";
import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";
import { defaultSchools, studentsOfCourse, studentsOfSchool, studentsOfState, studentsOfYear } from "@stu/lib";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const orgApplicators: NamespaceServerApplicatorMap<DomainEvent, "org", DatabaseError, Database | OrgRepository> =
  {
    "school.founded": {
      verify: Effect.fn(function* (event, { initiatorId }) {
        if (initiatorId !== SYSTEM_USER) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (yield* repo.doesSchoolExist({ id: event.data.id })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }
      }),
      apply: Effect.fn(function* (event) {
        const repo = yield* OrgRepository;
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (yield* repo.getPersonByAbbrv({ abbrv: event.data.abbrv })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }
      }),
      apply: (event) =>
        OrgRepository.use((repo) =>
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (yield* repo.getHoliday({ name: event.data.name, state: event.data.state, year: event.data.year })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }
      }),
      apply: Effect.fn(function* (event) {
        const repo = yield* OrgRepository;
        yield* repo.createHoliday({
          name: event.data.name,
          start: event.data.start,
          end: event.data.end,
          state: event.data.state,
          year: event.data.year,
        });

        const allHolidays = yield* repo.getAllHolidays();

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

        const affectedSchools = yield* repo.getSchoolsByState({ state: event.data.state });

        yield* repo.createSemesters(
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (yield* repo.getYear({ school: event.data.school, startYear: event.data.startYear })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }
      }),
      apply: (event) =>
        Effect.gen(function* () {
          const repo = yield* OrgRepository;

          yield* repo.createYear({
            name: event.data.name,
            startYear: event.data.startYear,
            graduationYear: event.data.graduationYear,
            school: event.data.school,
          });

          for (const cls of event.data.classes) {
            yield* repo.createClass({
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (yield* repo.getCourse({ id: event.data.id })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }

        for (const cls of event.data.classes) {
          if (
            yield* repo.getClass({
              identifierInYear: cls.identifierInYear,
              startYear: cls.startYear,
              school: event.data.school,
            })
          ) {
            return yield* Effect.fail(new ValidationError({ cause: "CLASS_NOT_FOUND" }));
          }
        }
      }),
      apply: (event) =>
        Effect.gen(function* () {
          const repo = yield* OrgRepository;

          yield* repo.createCourse({
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (yield* repo.getCourse({ id: event.data.course })) {
          return yield* Effect.fail(new ValidationError({ cause: "COURSE_NOT_FOUND" }));
        }
      }),
      apply: (event) =>
        Effect.gen(function* () {
          const repo = yield* OrgRepository;

          yield* repo.upsertTimetableEntry({
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (
          yield* repo.getSubstitution({
            course: event.data.course,
            start: event.data.start,
            originalTeacher: event.data.originalTeacher,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }
      }),
      apply: (event) =>
        Effect.gen(function* () {
          const repo = yield* OrgRepository;
          yield* repo.createSubstitution({
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        if (
          yield* repo.getSubstitution({
            course: event.data.course,
            start: event.data.start,
            originalTeacher: event.data.originalTeacher,
          })
        ) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS" }));
        }
      }),
      apply: (event) =>
        Effect.gen(function* () {
          const repo = yield* OrgRepository;
          yield* repo.createSubstitution({
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
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
        }

        const repo = yield* OrgRepository;
        const existingTimetableEntry = yield* repo.getTimetableEntry({
          course: event.data.course,
          start: event.data.start,
        });

        if (!existingTimetableEntry) {
          return yield* Effect.fail(new ValidationError({ cause: "DOES_NOT_EXIST" }));
        }
      }),
      apply: (event) =>
        Effect.gen(function* () {
          const repo = yield* OrgRepository;
          yield* repo.deleteTimetableEntry({
            course: event.data.course,
            start: event.data.start,
          });
        }),
      getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.course)]),
    },
  };
