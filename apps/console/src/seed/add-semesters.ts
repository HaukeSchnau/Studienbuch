import { randomUUID } from "crypto";
import dayjs from "dayjs";

import type { State } from "@stu/external-api";
import { ingest, SYSTEM_USER } from "@stu/api";
import { getHolidays } from "@stu/external-api";

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

    if (err === "EXISTS") {
      logger.debug(`Holiday ${holiday.name} already created!`);
    } else if (err) {
      logger.error(`Could not ingest holiday created event: ${err}`);
    } else {
      logger.info(`Holiday ${holiday.name} created!`);
    }
  }
};
