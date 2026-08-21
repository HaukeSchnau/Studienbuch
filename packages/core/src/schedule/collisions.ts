import * as Order from "effect/Order";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import type { BellPeriod } from "./bell-schedule";
import type { BellPeriodId, LessonOccurrenceId, RecurringMeetingId } from "./identity";
import type { LessonOccurrence } from "./lesson-occurrence";
import { LocalTimeRange } from "./local-time-range";
import { meetingOccursOn, type RecurringMeeting, rotationsCanCoincide } from "./recurring-meeting";

export interface BellPeriodCollision {
  readonly leftId: BellPeriodId;
  readonly rightId: BellPeriodId;
}

export interface RecurringMeetingCollision {
  readonly leftId: RecurringMeetingId;
  readonly rightId: RecurringMeetingId;
}

export interface LessonOccurrenceCollision {
  readonly leftId: LessonOccurrenceId;
  readonly rightId: LessonOccurrenceId;
}

/** Every unordered pair, each once. Indexing through `entries` keeps both elements defined. */
const pairs = <A>(values: ReadonlyArray<A>): ReadonlyArray<readonly [A, A]> =>
  values.flatMap((left, index) =>
    values.slice(index + 1).map((right): readonly [A, A] => [left, right]),
  );

const orderedPair = <Id extends string>(leftId: Id, rightId: Id) =>
  leftId < rightId ? { leftId, rightId } : { leftId: rightId, rightId: leftId };

const comparePairs = <Id extends string>(
  left: { readonly leftId: Id; readonly rightId: Id },
  right: { readonly leftId: Id; readonly rightId: Id },
) => Order.String(left.leftId, right.leftId) || Order.String(left.rightId, right.rightId);

const meetingsCanCoincide = (left: RecurringMeeting, right: RecurringMeeting): boolean => {
  if (
    left.weekday !== right.weekday ||
    !rotationsCanCoincide(left.rotation, right.rotation) ||
    !CalendarDateRange.overlaps(left.effectiveInterval, right.effectiveInterval) ||
    !LocalTimeRange.overlaps(left.timeRange, right.timeRange)
  ) {
    return false;
  }

  let date =
    PlainDate.compare(left.effectiveInterval.start, right.effectiveInterval.start) > 0
      ? left.effectiveInterval.start
      : right.effectiveInterval.start;
  const end =
    PlainDate.compare(left.effectiveInterval.end, right.effectiveInterval.end) < 0
      ? left.effectiveInterval.end
      : right.effectiveInterval.end;

  // Weekday and parity repeat every 14 days, so a longer scan cannot find a new pattern.
  for (let offset = 0; offset < 14 && PlainDate.compare(date, end) <= 0; offset += 1) {
    if (meetingOccursOn(left, date) && meetingOccursOn(right, date)) return true;
    if (PlainDate.equals(date, end)) break;
    date = PlainDate.addDays(date, 1);
  }
  return false;
};

export const findBellPeriodCollisions = (
  periods: ReadonlyArray<BellPeriod>,
): ReadonlyArray<BellPeriodCollision> =>
  pairs(periods)
    .filter(([left, right]) => LocalTimeRange.overlaps(left.timeRange, right.timeRange))
    .map(([left, right]) => orderedPair(left.id, right.id))
    .sort(comparePairs);

export const findRecurringMeetingCollisions = (
  meetings: ReadonlyArray<RecurringMeeting>,
): ReadonlyArray<RecurringMeetingCollision> =>
  pairs(meetings)
    .filter(([left, right]) => meetingsCanCoincide(left, right))
    .map(([left, right]) => orderedPair(left.id, right.id))
    .sort(comparePairs);

export const findLessonOccurrenceCollisions = (
  occurrences: ReadonlyArray<LessonOccurrence>,
): ReadonlyArray<LessonOccurrenceCollision> =>
  pairs(occurrences)
    .filter(
      ([left, right]) =>
        PlainDate.equals(left.date, right.date) &&
        LocalTimeRange.overlaps(left.timeRange, right.timeRange),
    )
    .map(([left, right]) => orderedPair(left.id, right.id))
    .sort(comparePairs);
