import { randomUUID } from "crypto";
import dayjs from "dayjs";

import type { State } from "@stu/external-api";
import { getHolidays } from "@stu/external-api";

import { api } from "../caller";

export const addSemesters = async (state: State) => {
  const holidays = await getHolidays(state);
  for (const holiday of holidays) {
    await api.events.ingest({
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
    });
  }
};
