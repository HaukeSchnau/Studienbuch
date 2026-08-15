import {
  addCalendarDays,
  dateIntervalsOverlap,
  timeRangesOverlap,
  type BellPeriodId,
  type LessonOccurrenceId,
  type RecurringMeetingId,
} from "../foundation";
import type { BellPeriod } from "./bell-schedule";
import type { LessonOccurrence } from "./lesson-occurrence";
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

const pairs = <A>(values: ReadonlyArray<A>): ReadonlyArray<readonly [A, A]> => {
  const result: Array<readonly [A, A]> = [];
  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    const left = values[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
      const right = values[rightIndex];
      if (right !== undefined) result.push([left, right]);
    }
  }
  return result;
};

const orderedPair = <Id extends string>(leftId: Id, rightId: Id) =>
  leftId < rightId ? { leftId, rightId } : { leftId: rightId, rightId: leftId };

const comparePairs = <Id extends string>(
  left: { readonly leftId: Id; readonly rightId: Id },
  right: { readonly leftId: Id; readonly rightId: Id },
) => left.leftId.localeCompare(right.leftId) || left.rightId.localeCompare(right.rightId);

const meetingsCanCoincide = (left: RecurringMeeting, right: RecurringMeeting): boolean => {
  if (
    left.weekday !== right.weekday ||
    !rotationsCanCoincide(left.rotation, right.rotation) ||
    !dateIntervalsOverlap(left.effectiveInterval, right.effectiveInterval) ||
    !timeRangesOverlap(left.timeRange, right.timeRange)
  ) {
    return false;
  }

  let date =
    left.effectiveInterval.start > right.effectiveInterval.start
      ? left.effectiveInterval.start
      : right.effectiveInterval.start;
  const end =
    left.effectiveInterval.end < right.effectiveInterval.end
      ? left.effectiveInterval.end
      : right.effectiveInterval.end;

  // Weekday and parity repeat every 14 days, so a longer scan cannot find a new pattern.
  for (let offset = 0; offset < 14 && date <= end; offset += 1) {
    if (meetingOccursOn(left, date) && meetingOccursOn(right, date)) return true;
    date = addCalendarDays(date, 1);
  }
  return false;
};

export const findBellPeriodCollisions = (
  periods: ReadonlyArray<BellPeriod>,
): ReadonlyArray<BellPeriodCollision> =>
  pairs(periods)
    .filter(([left, right]) => timeRangesOverlap(left.timeRange, right.timeRange))
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
        left.date === right.date && timeRangesOverlap(left.timeRange, right.timeRange),
    )
    .map(([left, right]) => orderedPair(left.id, right.id))
    .sort(comparePairs);
