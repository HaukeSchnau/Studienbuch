import { randomUUID } from "node:crypto";
import dayjs from "dayjs";

import { SYSTEM_USER, ingest } from "@stu/api";
import type { State } from "@stu/external-api";
import { getHolidays } from "@stu/external-api";

import { logger } from "../logger";
import { Exit } from "effect";

export const addSemesters = async (state: State) => {
  logger.info(`Importing holidays for ${state}...`);

  const holidays = await getHolidays(state);
  for (const holiday of holidays) {
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
        logger.debug(`Holiday ${holiday.name} already created!`);
      } else {
        logger.error(`Could not ingest holiday created event: ${err.cause.toString()}`);
      }
    } else {
      logger.info(`Holiday ${holiday.name} created!`);
    }
  }
};
