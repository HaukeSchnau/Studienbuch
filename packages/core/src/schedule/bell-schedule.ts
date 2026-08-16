import * as Schema from "effect/Schema";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import { SchoolId } from "../organization/identity";
import { BellPeriodId, BellScheduleId } from "./identity";
import { LocalTimeRange } from "./local-time-range";

export const BellPeriod = Schema.Struct({
  id: BellPeriodId,
  label: NonBlankText.Schema,
  timeRange: LocalTimeRange.Schema,
});
export interface BellPeriod extends Schema.Schema.Type<typeof BellPeriod> {}

export const BellSchedule = Schema.Struct({
  id: BellScheduleId,
  schoolId: SchoolId,
  effectiveInterval: CalendarDateRange.Schema,
  periods: Schema.Array(BellPeriod),
});
export interface BellSchedule extends Schema.Schema.Type<typeof BellSchedule> {}
