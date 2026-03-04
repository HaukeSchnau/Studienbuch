import { BunRuntime, BunServices } from "@effect/platform-bun";
import { bootstrapBroadcastAsync } from "@stu/api";
import { alias, and, eq, ne, recurringCourses } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { upsertCourses } from "@stu/legacy-import";
import { defaultSchools, ensureEntityDefined, SCHOOL_IDS, type SchoolId, Semester } from "@stu/lib";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { runtime } from "../../api/src/groundswell";
import { importClasses } from "./kadmos/import-classes";
import { importTeachers } from "./kadmos/import-teachers";
import { importTimetable } from "./kadmos/import-timetable";
import { currentSchoolYearId, provideUntisAuth } from "./kadmos/kadmos-utils";
import { addSchool } from "./seed/add-school";
import { addSemesters } from "./seed/add-semesters";
import { generateLicenses } from "./seed/generate-licenses";

const untisSync = Effect.fn(function* (school: SchoolId) {
  yield* addSemesters(defaultSchools[school].stateCode);

  const schoolYearId = yield* currentSchoolYearId;
  const { start, end } = yield* Semester.current.pipe(Effect.flatMap(ensureEntityDefined("current semester")));

  yield* importTeachers({ school, schoolYearId, start, end });
  yield* importClasses({ school, schoolYearId, start, end });

  yield* importTimetable({ school, schoolYearId, start, end });
});

type ParsedArgs = {
  readonly positionals: readonly string[];
  readonly options: ReadonlyMap<string, string>;
  readonly helpRequested: boolean;
};

const parseArgs = (args: readonly string[]): ParsedArgs => {
  const positionals: string[] = [];
  const options = new Map<string, string>();
  let helpRequested = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--help" || token === "-h") {
      helpRequested = true;
      continue;
    }

    if (token.startsWith("--")) {
      const [name, inlineValue] = token.slice(2).split("=", 2);
      if (inlineValue !== undefined) {
        options.set(name, inlineValue);
        continue;
      }
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for --${name}`);
      }
      options.set(name, next);
      index += 1;
      continue;
    }

    positionals.push(token);
  }

  return {
    positionals,
    options,
    helpRequested,
  };
};

const isSchoolId = (value: string): value is SchoolId => (SCHOOL_IDS as readonly string[]).includes(value);

const getRequiredSchoolOption = (args: ParsedArgs): SchoolId => {
  const school = args.options.get("school");
  if (!school) {
    throw new Error(`Missing required option --school (allowed: ${SCHOOL_IDS.join(", ")})`);
  }
  if (!isSchoolId(school)) {
    throw new Error(`Invalid --school value "${school}" (allowed: ${SCHOOL_IDS.join(", ")})`);
  }
  return school;
};

const getOptionalCountOption = (args: ParsedArgs): number => {
  const countRaw = args.options.get("count");
  if (!countRaw) {
    return 10;
  }
  const parsed = Number.parseInt(countRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --count value "${countRaw}" (must be a positive integer)`);
  }
  return parsed;
};

const pullEffect = (school: SchoolId) =>
  Effect.gen(function* () {
    yield* addSchool(school);
    yield* untisSync(school).pipe(provideUntisAuth(school));
  });

const legacyImportEffect = Effect.gen(function* () {
  const courses = yield* recurringCourses;
  yield* Effect.tryPromise(() => upsertCourses(courses));
});

const generateLicensesEffect = (count: number, school: SchoolId) =>
  Effect.gen(function* () {
    const keys = yield* generateLicenses(count, school);
    yield* Effect.log(keys);
  });

const pruneConflictsEffect = Effect.gen(function* () {
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
});

const bootstrapBroadcastEffect = Effect.gen(function* () {
  yield* Effect.tryPromise(() => bootstrapBroadcastAsync());
});

const printRootHelp = () => {
  console.log(`Studienbuch Console v1.0.0

Usage:
  console <command> [options]

Commands:
  pull --school=<${SCHOOL_IDS.join("|")}>
  legacy-import
  generate-licenses --school=<${SCHOOL_IDS.join("|")}> [--count=<number>]
  prune-conflicts
  bootstrap-broadcast
  help

Examples:
  console pull --school=igs-lil
  console generate-licenses --school=igs-lil --count=5
  console bootstrap-broadcast`);
};

const printCommandHelp = (command: string) => {
  switch (command) {
    case "pull":
      console.log(`Usage: console pull --school=<${SCHOOL_IDS.join("|")}>`);
      return;
    case "legacy-import":
      console.log("Usage: console legacy-import");
      return;
    case "generate-licenses":
      console.log(`Usage: console generate-licenses --school=<${SCHOOL_IDS.join("|")}> [--count=<number>]`);
      return;
    case "prune-conflicts":
      console.log("Usage: console prune-conflicts");
      return;
    case "bootstrap-broadcast":
      console.log("Usage: console bootstrap-broadcast");
      return;
    default:
      printRootHelp();
  }
};

const commandEffectFromArgv = (argv: readonly string[]) =>
  Effect.gen(function* () {
    const parsed = parseArgs(argv);
    const [command] = parsed.positionals;

    if (!command || command === "help") {
      yield* Effect.sync(printRootHelp);
      return;
    }

    if (parsed.helpRequested) {
      yield* Effect.sync(() => printCommandHelp(command));
      return;
    }

    switch (command) {
      case "pull": {
        const school = getRequiredSchoolOption(parsed);
        yield* pullEffect(school);
        return;
      }
      case "legacy-import": {
        yield* legacyImportEffect;
        return;
      }
      case "generate-licenses": {
        const school = getRequiredSchoolOption(parsed);
        const count = getOptionalCountOption(parsed);
        yield* generateLicensesEffect(count, school);
        return;
      }
      case "prune-conflicts": {
        yield* pruneConflictsEffect;
        return;
      }
      case "bootstrap-broadcast": {
        yield* bootstrapBroadcastEffect;
        return;
      }
      default: {
        throw new Error(`Unknown command "${command}"`);
      }
    }
  });

const argv = process.argv.slice(2);

const maybeHandleHelpWithoutRuntime = (rawArgv: readonly string[]) => {
  const parsed = parseArgs(rawArgv);
  const [command] = parsed.positionals;

  if (!command || command === "help") {
    printRootHelp();
    return true;
  }

  if (parsed.helpRequested) {
    printCommandHelp(command);
    return true;
  }

  return false;
};

try {
  if (maybeHandleHelpWithoutRuntime(argv)) {
    process.exit(0);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Console command failed: ${message}`);
  printRootHelp();
  process.exit(1);
}

const main = Effect.tryPromise(() =>
  runtime.runPromise(commandEffectFromArgv(argv).pipe(Effect.provide([BunServices.layer, FetchHttpClient.layer]))),
).pipe(
  Effect.catchAll((error) =>
    Effect.sync(() => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Console command failed: ${message}`);
      printRootHelp();
      process.exitCode = 1;
    }),
  ),
);

BunRuntime.runMain(main);
