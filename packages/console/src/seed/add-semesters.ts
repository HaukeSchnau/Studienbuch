import { randomUUID } from "node:crypto";
import dayjs from "dayjs";

import { SYSTEM_USER, ingest } from "@stu/api";
import type { State } from "@stu/external-api";
import { getHolidays } from "@stu/external-api";
import { Result } from "@stu/lib";

import { logger } from "../logger";

export const addSemesters = async (state: State) => {
  logger.info(`Importing holidays for ${state}...`);

  const holidays = await getHolidays(state);
  for (const holiday of holidays) {
    const err = await ingest(
      "org.holiday.created",
      {
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

    if (Result.isErr(err)) {
      if (err.error === "EXISTS") {
        logger.debug(`Holiday ${holiday.name} already created!`);
      } else {
        logger.error(`Could not ingest holiday created event: ${err.error}`);
      }
    } else {
      logger.info(`Holiday ${holiday.name} created!`);
    }
  }
};
