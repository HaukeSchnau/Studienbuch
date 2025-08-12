import { randomUUID } from "node:crypto";
import { ingest, SYSTEM_USER } from "@stu/api";
import type { State } from "@stu/external-api";
import { getHolidays } from "@stu/external-api";
import type { SimpleDate } from "@stu/lib";
import { Exit } from "effect";
import { logger } from "../logger";

const simpleDateToDate = (date: SimpleDate) => {
  return new Date(date.year, date.month - 1, date.day);
};

export const addSemesters = async (state: State, dryRun: boolean) => {
  logger.info(`Importing holidays for ${state}...`);

  const currentYear = new Date().getFullYear();
  const holidays = await getHolidays(state, currentYear);
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
          start: simpleDateToDate(holiday.start),
          end: simpleDateToDate(holiday.end),
          state: holiday.state,
          year: holiday.start.year,
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
