import { Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { recurringCourses } from "@stu/db";
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

const console = Command.make("console").pipe(Command.withSubcommands([pull, legacyImport, generateLicensesCommand]));

const cli = Command.run(console, {
  name: "Studienbuch Console",
  version: "v1.0.0",
});

cli(process.argv).pipe(
  Effect.provide(AppLayerLive),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain,
);
