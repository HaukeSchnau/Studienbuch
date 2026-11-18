/**
 * How a WebUntis timetable entry reads in our terms. Its positions name resources without their
 * ids, and which position holds teachers or rooms depends on the view, so they're read by type.
 */
import type { TimetableEntry } from "@schnau/webuntis-api/schemas";
import * as Option from "effect/Option";
import type { Lesson } from "@stu/core";

export * as WebUntisEntry from "./WebUntisEntry.ts";

const sortedUnique = (values: ReadonlyArray<string>) => [...new Set(values)].sort();

/** The short names of the entry's resources of one type: what it has now, and what a change removed. */
export const names = (entry: TimetableEntry, type: string) => {
  const positions = [entry.position1, entry.position2, entry.position3, entry.position4].flatMap(
    (position) => position ?? [],
  );

  return {
    current: sortedUnique(
      positions.flatMap(({ current }) =>
        current !== null && current.type === type && current.status !== "REMOVED"
          ? [current.shortName]
          : [],
      ),
    ),
    removed: sortedUnique(
      positions.flatMap(({ removed }) =>
        removed !== null && removed.type === type ? [removed.shortName] : [],
      ),
    ),
  };
};

/** The entry's WebUntis ids in ascending order, which is how two views of it are matched. */
export const ids = (entry: TimetableEntry): ReadonlyArray<number> =>
  [...entry.ids].sort((a, b) => a - b);

const clock = /(?:^|T)(?<hours>\d{2}):(?<minutes>\d{2})(?::(?<seconds>\d{2}))?$/u;

/**
 * `08:00`, `2026-11-09T08:00` or `2026-11-09T08:00:30` as milliseconds since midnight, and none
 * for a time no clock shows, such as `99:99`.
 */
export const timeOfDay = (text: string): Option.Option<number> => {
  const groups = clock.exec(text)?.groups;
  const hours = Number(groups?.hours);
  const minutes = Number(groups?.minutes);
  const seconds = Number(groups?.seconds ?? 0);

  return groups === undefined || hours > 23 || minutes > 59 || seconds > 59
    ? Option.none()
    : Option.some(((hours * 60 + minutes) * 60 + seconds) * 1000);
};

/** Whether WebUntis showed the day, so an empty one is evidence of no lessons. */
export const shown = (day: { readonly status: string }) =>
  day.status === "REGULAR" || day.status === "NO_DATA";

/**
 * Whether WebUntis hid the day from the account that read it, as it does with a student's days
 * from some date on. Such a day is no evidence of lessons or of none.
 */
export const hidden = (day: { readonly status: string }) =>
  day.status === "NOT_ALLOWED_FOR_RESOURCE";

/** WebUntis's statuses in our terms. One we don't know reads as a change. */
export const status = (entry: TimetableEntry): Lesson.Status => {
  switch (entry.status) {
    case "REGULAR":
      return "Regular";
    case "CANCELLED":
      return "Cancelled";
    case "ADDITIONAL":
      return "Added";
    default:
      return "Changed";
  }
};
