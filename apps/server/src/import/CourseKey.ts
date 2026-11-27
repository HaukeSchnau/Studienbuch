/**
 * Which course an entry of a class view is a lesson of: its subject and the classes it lists with
 * the view's own, so a Kopplung is one course in every view. Groups of one subject and classes that
 * meet at once under different teachers are parallel groups, a course each.
 */
import type { TimetableEntry } from "@schnau/webuntis-api/schemas";
import * as Option from "effect/Option";
import { WebUntisEntry } from "./WebUntisEntry.ts";

export * as CourseKey from "./CourseKey.ts";

const sorted = (names: Iterable<string>) => [...new Set(names)].sort();

/** A subject and the classes taught it together, such as `INF/11.1+11.2+11.3`. */
export const family = (subject: string, classes: Iterable<string>) =>
  `${subject}/${sorted(classes).join("+")}`;

/**
 * The family of an entry in the view of `viewClass`, and the classes it is taught to, which include
 * the view's own class although the view doesn't list it. An entry without a subject, such as a
 * day of events for the whole school, is one lesson of its classes too, but has no parallel
 * groups.
 */
export const familyOf = (
  subject: Option.Option<string>,
  entry: TimetableEntry,
  viewClass: string,
) => {
  const taughtTo = [...WebUntisEntry.names(entry, "CLASS").planned, viewClass];

  return {
    family: family(
      Option.getOrElse(subject, () => "?"),
      taughtTo,
    ),
    taughtTo,
    grouped: Option.isSome(subject),
  };
};

/** One parallel group of a family, by the teachers the plan gives it. */
const group = (familyKey: string, teachers: Iterable<string>) =>
  `${familyKey}/${sorted(teachers).join("+")}`;

/** An entry as parallel groups show in it. */
export interface Meeting {
  readonly family: string;
  readonly date: string;
  /** Milliseconds since midnight. */
  readonly start: number;
  /** The planned teachers' short names. */
  readonly teachers: ReadonlyArray<string>;
  /** As planned: no substitute, no cancellation, nothing added. */
  readonly regular: boolean;
}

/**
 * The families whose groups meet in parallel: two entries as planned, at the same start on the
 * same day, under different teachers. A cancelled lesson next to its replacement is no such pair,
 * and neither is a row without a teacher next to one with a teacher.
 */
export const parallel = (meetings: Iterable<Meeting>): ReadonlySet<string> => {
  const slots = new Map<string, { family: string; teachers: Set<string> }>();

  for (const meeting of meetings) {
    if (!meeting.regular || meeting.teachers.length === 0) continue;

    const slot = `${meeting.family}\n${meeting.date}\n${meeting.start}`;
    const teachers = sorted(meeting.teachers).join("+");
    const known = slots.get(slot);

    if (known === undefined)
      slots.set(slot, { family: meeting.family, teachers: new Set([teachers]) });
    else known.teachers.add(teachers);
  }

  return new Set(
    [...slots.values()].flatMap((slot) => (slot.teachers.size > 1 ? [slot.family] : [])),
  );
};

/**
 * The key of the course of a family's entry under its planned teachers. A group of a family in
 * `parallels` is a course of its own, and stays one in a run whose reads show no parallel
 * meeting, once `known` says an earlier run made it.
 */
export const resolver =
  (parallels: ReadonlySet<string>, known: (key: string) => boolean) =>
  (familyKey: string, teachers: Iterable<string>) => {
    const ofGroup = group(familyKey, teachers);

    return parallels.has(familyKey) || known(ofGroup) ? ofGroup : familyKey;
  };
