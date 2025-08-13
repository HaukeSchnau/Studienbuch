import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { defaultSchools, SCHOOL_IDS, SemesterRepository } from "@stu/lib";
import { Effect } from "effect";
import { AppLayerLive } from "../../api/src/groundswell";
import { importClasses } from "./kadmos/import-classes";
import { importTeachers } from "./kadmos/import-teachers";
import { importTimetable } from "./kadmos/import-timetable";
import { getCurrentSchoolYearId, setupAuth } from "./kadmos/kadmos-utils";
import { addSchool } from "./seed/add-school";
import { addSemesters } from "./seed/add-semesters";
import { generateLicenses } from "./seed/generate-licenses";

const school = Options.choice("school", SCHOOL_IDS);

const pull = Command.make(
  "pull",
  {
    school,
  },
  ({ school }) =>
    Effect.gen(function* () {
      yield* addSchool(school);
      yield* generateLicenses(10, school);

      yield* addSemesters(defaultSchools[school].stateCode);

      const authContext = yield* Effect.tryPromise(() => setupAuth(school));
      const schoolYearId = yield* Effect.tryPromise(() => getCurrentSchoolYearId(authContext));

      const semesterRepo = yield* SemesterRepository;
      const currentSemester = yield* semesterRepo.getCurrentSemester();
      if (!currentSemester) {
        return yield* Effect.fail("No current semester found"); // TODO: Tagged error
      }

      const { start, end } = currentSemester;

      yield* importTeachers({ school, schoolYearId, start, end }, authContext);
      yield* importClasses({ school, schoolYearId, start, end }, authContext);

      yield* Effect.tryPromise(() => importTimetable({ school, schoolYearId, start, end }, authContext));

      process.exit(0);
    }),
);

const console = Command.make("console").pipe(Command.withSubcommands([pull]));

const cli = Command.run(console, {
  name: "Studienbuch Console",
  version: "v1.0.0",
});

cli(process.argv).pipe(Effect.provide(AppLayerLive), Effect.provide(BunContext.layer), BunRuntime.runMain);
