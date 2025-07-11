import { Effect } from "effect";
import type { SchoolId, SubjectId } from "@stu/lib";
import { Database } from "../database";
import type { StateCode } from "@stu/lib";
import type { Salutation } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";

export class OrgRepository extends Effect.Service<OrgRepository>()("student/OrgRepository", {
  effect: Effect.gen(function* () {
    const doesSchoolExist = Effect.fn(function* (payload: {
      id: SchoolId;
    }) {
      const { execute } = yield* Database;

      const school = yield* execute((db) =>
        db.query.schools.findFirst({
          where: eq(tables.schools.id, payload.id),
        }),
      );

      return school !== undefined;
    });

    const createSchool = Effect.fn(function* (payload: {
      id: SchoolId;
      name: string;
      state: StateCode;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.schools).values({
          id: payload.id,
          name: payload.name,
          stateCode: payload.state,
        }),
      );
    });

    const doesTeacherExist = Effect.fn(function* (payload: {
      id: string;
    }) {
      const { execute } = yield* Database;

      const teacher = yield* execute((db) =>
        db.query.persons.findFirst({
          where: eq(tables.persons.id, payload.id),
        }),
      );

      return teacher !== undefined;
    });

    const createTeacher = Effect.fn(function* (payload: {
      personId: string;
      firstName?: string;
      lastName?: string;
      salutation?: Salutation;
      abbrv: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.persons).values({
          id: payload.personId,
          firstName: payload.firstName ?? "",
          lastName: payload.lastName ?? "",
          salutation: payload.salutation,
          abbrv: payload.abbrv,
        }),
      );
    });

    const doesHolidayExist = Effect.fn(function* (payload: {
      name: string;
      start: Date;
      end: Date;
      state: StateCode;
      year: number;
    }) {
      const { execute } = yield* Database;

      const holiday = yield* execute((db) =>
        db.query.holidays.findFirst({
          where: eq(tables.holidays.name, payload.name),
        }),
      );

      return holiday !== undefined;
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

      const allHolidays = yield* execute((db) => db.query.holidays.findMany());
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

        if (!start || !end) throw new Error("Start or end holidays are  undefined"); // TODO: Effect.fail

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

      const affectedSchools = yield* execute((db) =>
        db.query.schools.findMany({
          where: eq(tables.schools.stateCode, payload.state),
        }),
      );

      yield* execute((db) =>
        db
          .insert(tables.semesters)
          .values(
            affectedSchools.flatMap((school) =>
              semesters.map((semester) => ({
                ...semester,
                school: school.id,
              })),
            ),
          )
          .onConflictDoNothing()
          .execute(),
      );
    }, Database.asTransaction);

    const doesYearExist = Effect.fn(function* (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
    }) {
      const { execute } = yield* Database;

      const year = yield* execute((db) =>
        db.query.years.findFirst({
          where: and(eq(tables.years.startYear, payload.startYear), eq(tables.years.school, payload.school)),
        }),
      );

      return year !== undefined;
    });

    const createYear = Effect.fn(function* (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
      classes: Array<{
        identifierInYear: string;
        teachers: string[];
      }>;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.years).values({
          name: payload.name,
          startYear: payload.startYear,
          graduationYear: payload.graduationYear,
          school: payload.school,
        }),
      );

      for (const cls of payload.classes) {
        yield* execute((db) =>
          db.insert(tables.classes).values({
            identifierInYear: cls.identifierInYear,
            startYear: payload.startYear,
            school: payload.school,
          }),
        );

        for (const teacher of cls.teachers) {
          yield* execute((db) =>
            db.insert(tables.teachersToClasses).values({
              teacher,
              classIdentifier: cls.identifierInYear,
              classStartYear: payload.startYear,
              school: payload.school,
            }),
          );
        }
      }
    }, Database.asTransaction);

    const doesCourseExist = Effect.fn(function* (payload: {
      id: string;
    }) {
      const { execute } = yield* Database;

      const course = yield* execute((db) =>
        db.query.courses.findFirst({
          where: eq(tables.courses.id, payload.id),
        }),
      );

      return course !== undefined;
    });

    const createCourse = Effect.fn(function* (payload: {
      id: string;
      name: string;
      subject: SubjectId;
      school: SchoolId;
      semester: {
        type: "WINTER" | "SUMMER";
        year: number;
      };
      isMandatory: boolean;
      teachers: string[];
      classes: Array<{
        identifierInYear: string;
        startYear: number;
      }>;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.courses).values({
          id: payload.id,
          name: payload.name,
          subject: payload.subject,
          school: payload.school,
          semesterType: payload.semester.type,
          semesterYear: payload.semester.year,
          isMandatory: payload.isMandatory,
          isMember: false,
        }),
      );

      for (const teacher of payload.teachers) {
        yield* execute((db) =>
          db.insert(tables.coursesToTeachers).values({
            course: payload.id,
            teacher,
          }),
        );
      }

      for (const cls of payload.classes) {
        yield* execute((db) =>
          db.insert(tables.coursesToClasses).values({
            course: payload.id,
            classIdentifier: cls.identifierInYear,
            classStartYear: cls.startYear,
            school: payload.school,
          }),
        );
      }
    }, Database.asTransaction);

    const doesTimetableEntryExist = Effect.fn(function* (payload: {
      start: Date;
      course: string;
    }) {
      const { execute } = yield* Database;

      const timetableEntry = yield* execute((db) =>
        db.query.timetableEntries.findFirst({
          where: and(
            eq(tables.timetableEntries.course, payload.course),
            eq(tables.timetableEntries.start, payload.start),
          ),
        }),
      );

      return timetableEntry !== undefined;
    });

    const createTimetableEntry = Effect.fn(function* (payload: {
      start: Date;
      duration: number;
      course: string;
      rooms: string[];
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.timetableEntries).values({
          start: payload.start,
          duration: payload.duration,
          course: payload.course,
        }),
      );

      for (const room of payload.rooms) {
        yield* execute((db) =>
          db.insert(tables.timetableEntryRooms).values({
            start: payload.start,
            course: payload.course,
            roomNumber: room,
          }),
        );
      }
    }, Database.asTransaction);

    const createSubstitution = Effect.fn(function* (payload: {
      start: Date;
      course: string;
      substitute: string | null;
      type: "VERTRETUNG" | "ENTFALL";
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.substitutions).values({
          start: payload.start,
          course: payload.course,
          substitute: payload.substitute,
          type: payload.type,
        }),
      );
    });

    const deleteTimetableEntry = Effect.fn(function* (payload: {
      start: Date;
      course: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .delete(tables.timetableEntries)
          .where(
            and(eq(tables.timetableEntries.course, payload.course), eq(tables.timetableEntries.start, payload.start)),
          ),
      );
    });

    return {
      doesSchoolExist,
      createSchool,
      doesTeacherExist,
      createTeacher,
      doesHolidayExist,
      createHoliday,
      doesYearExist,
      createYear,
      doesCourseExist,
      createCourse,
      doesTimetableEntryExist,
      createTimetableEntry,
      createSubstitution,
      deleteTimetableEntry,
    };
  }),
}) {}
