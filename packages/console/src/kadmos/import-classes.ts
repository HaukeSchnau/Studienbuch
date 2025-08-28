import { ingestEffect } from "@stu/api";
import { UntisClasses } from "@stu/external-api";
import type { SchoolId, SimpleDate } from "@stu/lib";
import { BetterMap, Year } from "@stu/lib";
import { Effect } from "effect";
import { getTeacherIdByAbbrv } from "~/util";
import { type ClassV2, mapKadmosClassV2 } from "../map-kadmos-class";

interface Options {
  school: SchoolId;
  schoolYearId: number;
  start: SimpleDate;
  end: SimpleDate;
}

const addYear = Effect.fn(function* (
  year: {
    startYear: number;
    name: string | null;
  },
  school: SchoolId,
  classes: ClassV2[],
) {
  const name = Year.getYearName(year) ?? year.name ?? year.startYear.toString();

  yield* ingestEffect({
    type: "org.year.started",
    data: {
      name,
      graduationYear: year.startYear + 9,
      startYear: year.startYear,
      school,
      classes: yield* Effect.all(
        classes.map((cls) =>
          Effect.gen(function* () {
            const teachers = yield* Effect.all(cls.teachers.map((teacher) => getTeacherIdByAbbrv(teacher.abbrv)));

            return {
              identifierInYear: cls.identifierInYear,
              teachers,
            };
          }),
        ),
      ),
    },
  }).pipe(
    Effect.tap(() => Effect.logInfo(`Year ${name} started!`)),
    Effect.catchIf(
      (error) => error.reason === "DUPLICATE",
      () => Effect.logDebug(`Year ${name} already started!`),
    ),
  );
});

export const importClasses = Effect.fn(function* (options: Options) {
  yield* Effect.logInfo(`Importing classes for school year "${options.schoolYearId}"...`);

  const classes = yield* UntisClasses.list(options).pipe(
    Effect.map((classes) => classes.classes.map(mapKadmosClassV2)),
  );

  const years = BetterMap.uniqueFromValues(
    classes.map(({ startYear, yearName }) => ({
      startYear,
      name: yearName,
    })),
    "startYear",
  ).values();

  for (const year of years) {
    const classesInYear = classes.filter((cls) => cls.startYear === year.startYear);

    // make sure that classes are unique by identifierInYear
    const classesInYearUnique = classesInYear.filter(
      (cls, index, self) => index === self.findIndex((otherCls) => otherCls.identifierInYear === cls.identifierInYear),
    );

    yield* addYear(year, options.school, classesInYearUnique);
  }
});
