import * as Schema from "effect/Schema";
import {
  BellPeriodId,
  BellScheduleId,
  DateInterval,
  NonEmptyText,
  SchoolId,
  TimeRange,
} from "../foundation";

export const BellPeriod = Schema.Struct({
  id: BellPeriodId,
  label: NonEmptyText,
  timeRange: TimeRange,
});
export interface BellPeriod extends Schema.Schema.Type<typeof BellPeriod> {}

export const BellSchedule = Schema.Struct({
  id: BellScheduleId,
  schoolId: SchoolId,
  effectiveInterval: DateInterval,
  periods: Schema.Array(BellPeriod),
});
export interface BellSchedule extends Schema.Schema.Type<typeof BellSchedule> {}
