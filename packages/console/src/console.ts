import { Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { bootstrapBroadcastAsync } from "@stu/api";
import { alias, and, eq, ne, recurringCourses } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { upsertCourses } from "@stu/legacy-import";
import { defaultSchools, ensureEntityDefined, SCHOOL_IDS, type SchoolId, Semester } from "@stu/lib";
import { Effect } from "effect";
import { AppLayerLive } from "../../api/src/groundswell";
import { importClasses } from "./kadmos/import-classes";
import { importTeachers } from "./kadmos/import-teachers";
import { importTimetable } from "./kadmos/import-timetable";
import { currentSchoolYearId, provideUntisAuth } from "./kadmos/kadmos-utils";
import { addSchool } from "./seed/add-school";
import { addSemesters } from "./seed/add-semesters";
import { generateLicenses } from "./seed/generate-licenses";

const school = Options.choice("school", SCHOOL_IDS);

const untisSync = Effect.fn(function* (school: SchoolId) {
  yield* addSemesters(defaultSchools[school].stateCode);

  const schoolYearId = yield* currentSchoolYearId;
  const { start, end } = yield* Semester.current.pipe(Effect.flatMap(ensureEntityDefined("current semester")));

  yield* importTeachers({ school, schoolYearId, start, end });
  yield* importClasses({ school, schoolYearId, start, end });

  yield* importTimetable({ school, schoolYearId, start, end });
});

const pull = Command.make(
  "pull",
  {
    school,
  },
  ({ school }) =>
    Effect.gen(function* () {
      yield* addSchool(school);

      yield* untisSync(school).pipe(provideUntisAuth(school));

      process.exit(0);
    }),
);

const legacyImport = Command.make("legacy-import", {}, () =>
  Effect.gen(function* () {
    const courses = yield* recurringCourses;
    yield* Effect.tryPromise(() => upsertCourses(courses));

    process.exit(0);
  }),
);

const count = Options.integer("count").pipe(Options.withDefault(10));
const generateLicensesCommand = Command.make(
  "generate-licenses",
  {
    count,
    school,
  },
  ({ count, school }) =>
    Effect.gen(function* () {
      const keys = yield* generateLicenses(count, school);
      yield* Effect.log(keys);
      process.exit(0);
    }),
);

const pruneConflictsCommand = Command.make("prune-conflicts", {}, () =>
  Effect.gen(function* () {
    const te1 = alias(tables.TimetableEntries, "te1");
    const te2 = alias(tables.TimetableEntries, "te2");
    const course1 = alias(tables.Courses, "course1");
    const course2 = alias(tables.Courses, "course2");
    const coursesToTeachers1 = alias(tables.CoursesToTeachers, "coursesToTeachers1");
    const coursesToTeachers2 = alias(tables.CoursesToTeachers, "coursesToTeachers2");

    const conflicts = yield* Effect.tryPromise(() =>
      db
        .select()
        .from(course1)
        .innerJoin(te1, eq(course1.id, te1.course))
        .innerJoin(coursesToTeachers1, eq(course1.id, coursesToTeachers1.course))
        .innerJoin(coursesToTeachers2, eq(coursesToTeachers1.teacher, coursesToTeachers2.teacher))
        .innerJoin(course2, eq(coursesToTeachers2.course, course2.id))
        .innerJoin(te2, eq(course2.id, te2.course))
        .innerJoin(tables.Persons, eq(coursesToTeachers1.teacher, tables.Persons.id))
        .where(and(eq(te1.start, te2.start), ne(course1.id, course2.id))),
    );

    yield* Effect.sync(() => {
      console.log(conflicts);
    });
    process.exit(0);
  }),
);

const bootstrapBroadcastCommand = Command.make("bootstrap-broadcast", {}, () =>
  Effect.gen(function* () {
    yield* Effect.tryPromise(() => bootstrapBroadcastAsync());
    process.exit(0);
  }),
);

const consoleCommand = Command.make("console").pipe(
  Command.withSubcommands([
    pull,
    legacyImport,
    generateLicensesCommand,
    pruneConflictsCommand,
    bootstrapBroadcastCommand,
  ]),
);

const cli = Command.run(consoleCommand, {
  name: "Studienbuch Console",
  version: "v1.0.0",
});

cli(process.argv).pipe(
  Effect.provide(AppLayerLive),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain,
);
