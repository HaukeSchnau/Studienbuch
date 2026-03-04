import { Command, Options } from "@effect/cli";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { SCHOOL_IDS } from "@stu/lib";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const school = Options.choice("school", SCHOOL_IDS);

const pull = Command.make(
  "pull",
  {
    school,
  },
  ({ school }) =>
    Effect.gen(function* () {
      const [
        { addSchool },
        { addSemesters },
        { defaultSchools, ensureEntityDefined, Semester },
        { currentSchoolYearId, provideUntisAuth },
        { importTeachers },
        { importClasses },
        { importTimetable },
      ] = yield* Effect.tryPromise(() =>
        Promise.all([
          import("./seed/add-school"),
          import("./seed/add-semesters"),
          import("@stu/lib"),
          import("./kadmos/kadmos-utils"),
          import("./kadmos/import-teachers"),
          import("./kadmos/import-classes"),
          import("./kadmos/import-timetable"),
        ]),
      );

      yield* addSchool(school);
      yield* Effect.gen(function* () {
        yield* addSemesters(defaultSchools[school].stateCode);

        const schoolYearId = yield* currentSchoolYearId;
        const { start, end } = yield* Semester.current.pipe(Effect.flatMap(ensureEntityDefined("current semester")));

        yield* importTeachers({ school, schoolYearId, start, end });
        yield* importClasses({ school, schoolYearId, start, end });
        yield* importTimetable({ school, schoolYearId, start, end });
      }).pipe(provideUntisAuth(school));

      process.exit(0);
    }),
);

const legacyImport = Command.make("legacy-import", {}, () =>
  Effect.gen(function* () {
    const [{ recurringCourses }, { upsertCourses }] = yield* Effect.tryPromise(() =>
      Promise.all([import("@stu/db"), import("@stu/legacy-import")]),
    );

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
      const { generateLicenses } = yield* Effect.tryPromise(() => import("./seed/generate-licenses"));
      const keys = yield* generateLicenses(count, school);

      yield* Effect.log(keys);
      process.exit(0);
    }),
);

const pruneConflictsCommand = Command.make("prune-conflicts", {}, () =>
  Effect.gen(function* () {
    const [{ alias, and, eq, ne }, { db }, tables] = yield* Effect.tryPromise(() =>
      Promise.all([import("@stu/db"), import("@stu/db/client"), import("@stu/db/schema")]),
    );

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
    const { bootstrapBroadcastAsync } = yield* Effect.tryPromise(() => import("@stu/api"));
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

const normalizeArgv = (argv: readonly string[]) => {
  const normalized = argv.slice(2);
  if (normalized[0] === "--") {
    normalized.shift();
  }

  return normalized;
};

const isInfoOnlyInvocation = (argv: readonly string[]) => {
  const args = normalizeArgv(argv);
  return args.some((arg) => arg === "--help" || arg === "-h" || arg === "--version" || arg === "-v" || arg === "-V");
};

export const runConsole = (argv: readonly string[]) => {
  const program = cli(argv).pipe(Effect.provide([BunServices.layer, FetchHttpClient.layer]));

  if (isInfoOnlyInvocation(argv)) {
    BunRuntime.runMain(program as never);
    return;
  }

  const main = Effect.tryPromise(async () => {
    const { runtime } = await import("../../api/src/groundswell");
    return runtime.runPromise(program);
  });

  BunRuntime.runMain(main);
};
