import { ingest, SYSTEM_USER } from "@stu/api";
import { type AuthContext, getClassesV2 } from "@stu/external-api";
import type { SchoolId } from "@stu/lib";
import { BetterMap, startYearToNameMap } from "@stu/lib";
import { Exit } from "effect";
import { ConsoleIservClient } from "../get-or-create-teacher";
import { logger } from "../logger";
import { mapKadmosClassV2 } from "../map-kadmos-class";
import { getBroadRange } from "./kadmos-utils";

interface Options {
  school: SchoolId;
  schoolYearId: number;
  dryRun: boolean;
}

export const importClasses = async ({ school, schoolYearId, dryRun }: Options, authContext: AuthContext) => {
  logger.info(`Importing classes for school year "${schoolYearId}"...`);

  const { start, end } = getBroadRange();
  const classes = await getClassesV2(start, end, schoolYearId, authContext).then((classes) =>
    classes.classes.map(mapKadmosClassV2),
  );

  const years = BetterMap.uniqueFromValues(
    classes.map(({ startYear, yearName }) => ({
      startYear,
      name: yearName,
    })),
    "startYear",
  ).values();

  const iservClient = new ConsoleIservClient();

  for (const year of years) {
    const classesInYear = classes.filter((cls) => cls.startYear === year.startYear);

    // make sure that classes are unique by identifierInYear
    const classesInYearUnique = classesInYear.filter(
      (cls, index, self) => index === self.findIndex((otherCls) => otherCls.identifierInYear === cls.identifierInYear),
    );

    const name = startYearToNameMap.get(year.startYear) ?? year.name ?? year.startYear.toString();

    if (!dryRun) {
      const err = await ingest(
        {
          type: "org.year.started",
          data: {
            name,
            graduationYear: year.startYear + 9,
            startYear: year.startYear,
            school,
            classes: await Promise.all(
              classesInYearUnique.map(async (cls) => ({
                identifierInYear: cls.identifierInYear,
                teachers: await Promise.all(
                  cls.teachers.map((teacher) => iservClient.getOrCreateTeacher(teacher.abbrv)),
                ),
              })),
            ),
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        SYSTEM_USER,
      );

      if (Exit.isFailure(err)) {
        if (err.cause._tag === "Fail" && err.cause.error.reason === "DUPLICATE") {
          logger.debug(`Year ${name} already started!`);
        } else {
          logger.error(`Could not ingest year started event: ${err.cause.toString()}`);
        }
      } else {
        logger.info(`Year ${name} started!`);
      }
    } else {
      logger.info(`Year ${name} would have been started!`);
    }
  }
};
