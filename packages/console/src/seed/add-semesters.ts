import { randomUUID } from "node:crypto";
import { ingestEffect, SYSTEM_USER } from "@stu/api";
import type { State } from "@stu/external-api";
import { getHolidays } from "@stu/external-api";
import { Effect } from "effect";

export const addSemesters = Effect.fn(function* (state: State) {
  yield* Effect.logInfo(`Importing holidays for ${state}...`);

  const currentYear = new Date().getFullYear();
  const holidays = yield* getHolidays(state, currentYear);
  for (const holiday of holidays) {
    yield* ingestEffect(
      {
        type: "org.holiday.created",
        id: randomUUID(),
        timestamp: new Date(),
        data: {
          name: holiday.name,
          start: holiday.start,
          end: holiday.end,
          state: holiday.state,
          year: holiday.start.year,
        },
      },
      SYSTEM_USER,
    ).pipe(
      Effect.tap(() => Effect.logInfo(`Holiday ${holiday.name} created!`)),
      Effect.catchIf(
        (error) => error.reason === "DUPLICATE",
        () => Effect.logInfo(`Holiday ${holiday.name} already created!`),
      ),
    );
  }
});
