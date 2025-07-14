import { Effect } from "effect";
import type { Salutation, SchoolId, SemesterType, StateCode, SubstitutionType } from "@stu/lib";
import { Database } from "../database";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";
import type { Subject } from "../schema/school/courses";

export class OrgRepository extends Effect.Service<OrgRepository>()("org/OrgRepository", {
  effect: Effect.gen(function* () {
    const getSchool = Effect.fn(function* (payload: {
      id: SchoolId;
    }) {
      const { execute } = yield* Database;
      const rows = yield* execute((db) => db.select().from(tables.Schools).where(eq(tables.Schools.id, payload.id)));
      return rows[0];
    });

    const doesSchoolExist = Effect.fn(function* (payload: {
      id: SchoolId;
    }) {
      const school = yield* getSchool({ id: payload.id });
      return school !== undefined;
    });

    const createSchool = Effect.fn(function* (payload: {
      id: SchoolId;
      name: string;
      stateCode: StateCode;
      image: string;
      theme: Record<string, unknown>;
      kadmosName: string;
      kadmosUsername: string;
      kadmosPassword: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.Schools).values({
          id: payload.id,
          name: payload.name,
          stateCode: payload.stateCode,
          image: payload.image,
          theme: payload.theme,
          kadmosName: payload.kadmosName,
          kadmosUsername: payload.kadmosUsername,
          kadmosPassword: payload.kadmosPassword,
        }),
      );
    });

    const getPersonByAbbrv = Effect.fn(function* (payload: {
      abbrv: string;
    }) {
      const { execute } = yield* Database;
      const rows = yield* execute((db) =>
        db.select().from(tables.Persons).where(eq(tables.Persons.abbrv, payload.abbrv)),
      );
      return rows[0];
    });

    const createPerson = Effect.fn(function* (payload: {
      id: string;
      firstName: string;
      lastName: string;
      salutation: Salutation | undefined;
      abbrv: string;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Persons).values({
          id: payload.id,
          firstName: payload.firstName,
          lastName: payload.lastName,
          salutation: payload.salutation,
          abbrv: payload.abbrv,
        }),
      );
    });

    const createRoom = Effect.fn(function* (payload: {
      roomNumber: string;
      name: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .insert(tables.Rooms)
          .values({
            roomNumber: payload.roomNumber,
            name: payload.name,
          })
          .onConflictDoUpdate({
            target: [tables.Rooms.roomNumber],
            set: {
              name: payload.name,
            },
          }),
      );
    });

    const getHoliday = Effect.fn(function* (payload: {
      name: string;
      state: StateCode;
      year: number;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.holidays.findFirst({
          where: and(
            eq(tables.holidays.name, payload.name),
            eq(tables.holidays.state, payload.state),
            eq(tables.holidays.year, payload.year),
          ),
        }),
      );
    });

    const createHoliday = Effect.fn(function* (payload: {
      name: string;
      start: Date;
      end: Date;
      state: StateCode;
      year: number;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.holidays).values({
          name: payload.name,
          start: payload.start,
          end: payload.end,
          state: payload.state,
          year: payload.year,
        }),
      );
    });

    const getAllHolidays = Effect.fn(function* () {
      const { execute } = yield* Database;
      return yield* execute((db) => db.query.holidays.findMany());
    });

    const getSchoolsByState = Effect.fn(function* (payload: {
      state: StateCode;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.select().from(tables.Schools).where(eq(tables.Schools.stateCode, payload.state)),
      );
    });

    const createSemesters = Effect.fn(function* (
      payload: {
        name: string;
        start: Date;
        end: Date;
        type: "WINTER" | "SUMMER";
        year: number;
        school: SchoolId;
      }[],
    ) {
      const { execute } = yield* Database;

      yield* execute((db) => db.insert(tables.Semesters).values(payload));
    });

    const getYear = Effect.fn(function* (payload: {
      school: SchoolId;
      startYear: number;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Years.findFirst({
          where: and(eq(tables.Years.startYear, payload.startYear), eq(tables.Years.school, payload.school)),
        }),
      );
    });

    const createYear = Effect.fn(function* (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Years).values({
          name: payload.name,
          startYear: payload.startYear,
          graduationYear: payload.graduationYear,
          school: payload.school,
        }),
      );
    });

    const createClass = Effect.fn(function* (payload: {
      identifierInYear: string;
      startYear: number;
      school: SchoolId;
      teachers: string[];
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Classes).values({
          identifierInYear: payload.identifierInYear,
          startYear: payload.startYear,
          school: payload.school,
        }),
      );

      for (const teacher of payload.teachers) {
        yield* execute((db) =>
          db.insert(tables.TeachersToClasses).values({
            teacher,
            classIdentifier: payload.identifierInYear,
            classStartYear: payload.startYear,
            school: payload.school,
          }),
        );
      }
    }, Database.asTransaction);

    const getCourse = Effect.fn(function* (payload: {
      id: string;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Courses.findFirst({
          where: eq(tables.Courses.id, payload.id),
        }),
      );
    });

    const getClass = Effect.fn(function* (payload: {
      identifierInYear: string;
      startYear: number;
      school: SchoolId;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Classes.findFirst({
          where: and(
            eq(tables.Classes.school, payload.school),
            eq(tables.Classes.identifierInYear, payload.identifierInYear),
            eq(tables.Classes.startYear, payload.startYear),
          ),
        }),
      );
    });

    const createCourse = Effect.fn(function* (payload: {
      id: string;
      name: string;
      subject: (typeof Subject.enumValues)[number];
      school: SchoolId;
      semester: {
        type: SemesterType;
        year: number;
      };
      isMandatory: boolean;
      teachers: string[];
      classes: {
        identifierInYear: string;
        startYear: number;
      }[];
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Courses).values({
          id: payload.id,
          name: payload.name,
          subject: payload.subject,
          school: payload.school,
          semesterType: payload.semester.type,
          semesterYear: payload.semester.year,
          isMandatory: payload.isMandatory,
        }),
      );

      for (const teacher of payload.teachers) {
        yield* execute((db) =>
          db.insert(tables.CoursesToTeachers).values({
            course: payload.id,
            teacher,
          }),
        );
      }

      for (const cls of payload.classes) {
        yield* execute((db) =>
          db.insert(tables.CoursesToClasses).values({
            course: payload.id,
            classIdentifier: cls.identifierInYear,
            classStartYear: cls.startYear,
            school: payload.school,
          }),
        );
      }
    }, Database.asTransaction);

    const getTimetableEntry = Effect.fn(function* (payload: {
      course: string;
      start: Date;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.TimetableEntries.findFirst({
          where: and(
            eq(tables.TimetableEntries.course, payload.course),
            eq(tables.TimetableEntries.start, payload.start),
          ),
        }),
      );
    });

    const upsertTimetableEntry = Effect.fn(function* (payload: {
      course: string;
      start: Date;
      duration: number;
      rooms: string[];
    }) {
      const { execute } = yield* Database;
      const existingTimetableEntry = yield* getTimetableEntry({ course: payload.course, start: payload.start });
      yield* execute((db) =>
        db
          .insert(tables.TimetableEntries)
          .values({
            start: payload.start,
            duration: payload.duration,
            course: payload.course,
            rooms: payload.rooms,
          })
          .onConflictDoUpdate({
            target: [tables.TimetableEntries.start, tables.TimetableEntries.course],
            set: {
              // TODO: We might want to overwrite these values
              duration: Math.max(existingTimetableEntry?.duration ?? 0, payload.duration),
              rooms: [...new Set([...payload.rooms, ...(existingTimetableEntry?.rooms ?? [])])],
            },
          }),
      );
    }, Database.asTransaction);

    const getSubstitution = Effect.fn(function* (payload: {
      course: string;
      start: Date;
      originalTeacher: string;
    }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Substitutions.findFirst({
          where: and(
            eq(tables.Substitutions.start, payload.start),
            eq(tables.Substitutions.course, payload.course),
            eq(tables.Substitutions.originalTeacher, payload.originalTeacher),
          ),
        }),
      );
    });

    const createSubstitution = Effect.fn(function* (
      payload: {
        course: string;
        start: Date;
        originalTeacher: string;
      } & (
        | {
            substitute: string;
            type: SubstitutionType;
          }
        | { substitute?: never; type: "ENTFALL" }
      ),
    ) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Substitutions).values({
          course: payload.course,
          start: payload.start,
          originalTeacher: payload.originalTeacher,
          substitute: payload.substitute ?? null,
          updatedAt: new Date(),
          type: payload.type,
        }),
      );
    });

    const deleteTimetableEntry = Effect.fn(function* (payload: {
      course: string;
      start: Date;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db
          .delete(tables.TimetableEntries)
          .where(
            and(eq(tables.TimetableEntries.course, payload.course), eq(tables.TimetableEntries.start, payload.start)),
          ),
      );
    });

    return {
      getSchool,
      doesSchoolExist,
      createSchool,
      getPersonByAbbrv,
      createPerson,
      createCourse,
      createRoom,
      getHoliday,
      createHoliday,
      getAllHolidays,
      getSchoolsByState,
      createSemesters,
      getYear,
      createYear,
      createClass,
      getCourse,
      getClass,
      getTimetableEntry,
      upsertTimetableEntry,
      getSubstitution,
      createSubstitution,
      deleteTimetableEntry,
    };
  }),
}) {}
