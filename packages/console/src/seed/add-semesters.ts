import { randomUUID } from "node:crypto";
import { ingest, SYSTEM_USER } from "@stu/api";
import type { State } from "@stu/external-api";
import { getHolidays } from "@stu/external-api";
import dayjs from "dayjs";
import { Exit } from "effect";
import { logger } from "../logger";

export const addSemesters = async (state: State, dryRun: boolean) => {
  logger.info(`Importing holidays for ${state}...`);

  const holidays = await getHolidays(state);
  for (const holiday of holidays) {
    if (dryRun) {
      logger.info(`Holiday: ${JSON.stringify(holiday, null, 2)}`);
      continue;
    }

    const err = await ingest(
      {
        type: "org.holiday.created",
        id: randomUUID(),
        timestamp: new Date(),
        data: {
          name: holiday.name,
          start: dayjs(holiday.start).toDate(),
          end: dayjs(holiday.end).toDate(),
          state: holiday.stateCode,
          year: holiday.year,
        },
      },
      SYSTEM_USER,
    );

    if (Exit.isFailure(err)) {
      if (err.cause._tag === "Fail" && err.cause.error.reason === "DUPLICATE") {
        logger.info(`Holiday ${holiday.name} already created!`);
      } else {
        logger.error(`Could not ingest holiday created event: ${err.cause.toString()}`);
      }
    } else {
      logger.info(`Holiday ${holiday.name} created!`);
    }
  }
};
