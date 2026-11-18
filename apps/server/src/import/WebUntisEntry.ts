/**
 * How a WebUntis timetable entry reads in our terms. Its positions name resources without their
 * ids, and which position holds teachers or rooms depends on the view, so they're read by type.
 */
import type { TimetableEntry } from "@schnau/webuntis-api/schemas";
import * as Option from "effect/Option";
import type { SchoolImport } from "./SchoolImport.ts";

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

/** `08:00`, `2026-11-09T08:00` or `2026-11-09T08:00:30` as milliseconds since midnight. */
export const timeOfDay = (text: string): Option.Option<number> => {
  const groups = clock.exec(text)?.groups;

  return groups === undefined
    ? Option.none()
    : Option.some(
        ((Number(groups.hours) * 60 + Number(groups.minutes)) * 60 + Number(groups.seconds ?? 0)) *
          1000,
      );
};

/** Whether WebUntis showed the day, so an empty one is evidence of no lessons. */
export const shown = (day: { readonly status: string }) =>
  day.status === "REGULAR" || day.status === "NO_DATA";

/** WebUntis's statuses in our terms. One we don't know reads as a change. */
export const status = (entry: TimetableEntry): SchoolImport.LessonStatus => {
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
