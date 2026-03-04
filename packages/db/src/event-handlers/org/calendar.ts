import { ValidationError } from "@groundswell/core";
import {
  applyOrgHolidayCreated,
  applyOrgYearStarted,
  studentsOfState,
  studentsOfYear,
  verifyOrgHolidayCreated,
  verifyOrgYearStarted,
} from "@stu/lib";
import { Effect } from "effect";
import { Database } from "../../database";
import { verifySystemInitiator } from "./context";
import type { OrgApplicatorMap } from "./types";

export const calendarApplicators: Pick<OrgApplicatorMap, "holiday.created" | "year.started"> = {
  "holiday.created": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        yield* verifyOrgHolidayCreated({
          data: event.data as never,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });
      }),
    apply: (event) =>
      applyOrgHolidayCreated({
        data: event.data as never,
      }).pipe(Database.asTransaction),
    getEventTopics: (event) => Effect.succeed([studentsOfState(event.data.state)]),
  },
  "year.started": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        yield* verifyOrgYearStarted({
          data: event.data as never,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });
      }),
    apply: (event) =>
      applyOrgYearStarted({
        data: event.data as never,
      }).pipe(Database.asTransaction),
    getEventTopics: (event) =>
      Effect.succeed([
        studentsOfYear({
          school: event.data.school,
          startYear: event.data.startYear,
        }),
      ]),
  },
};
