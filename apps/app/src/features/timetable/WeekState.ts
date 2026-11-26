import { CivilTime, Timetable } from "@stu/core";
import { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import { WeekItem } from "@stu/domain-ui/timetable/WeekItem";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { DeviceStatus } from "../device-status/DeviceStatus.ts";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { TimetableState } from "./TimetableState.ts";

// What Meine Woche shows, put together from the account's atoms, so its screen only draws.

export * as WeekState from "./WeekState.ts";

/** The grid of a school that has a timetable, and the day list that replaces it at large text. */
export interface Grid {
  readonly week: WeekItem.Week;
  /** Each column of `week` as the day list shows it. */
  readonly days: ReadonlyArray<WeekItem.DayList>;
  /** The Stand in the card's foot, once it is old. */
  readonly stand: AgendaItem.Stand | undefined;
}

export interface Screen {
  /** The shown week and its neighbours as ISO weeks, such as `2026-W48`, for the route. */
  readonly week: { readonly previous: string; readonly next: string };
  /** The week opened by default: this one, or the next on Saturday and Sunday. */
  readonly current: boolean;
  /** "16.–20. November" */
  readonly heading: string;
  /** "KW 47", "A-Woche" */
  readonly chips: ReadonlyArray<string>;
  readonly offline: DeviceStatus.Status["offline"];
  /** `None` at a school without a timetable: no lessons on the device and no Stand. */
  readonly grid: Option.Option<Grid>;
}

/**
 * Meine Woche of the account for `requested`, an ISO week such as `2026-W48`, or the week it opens
 * by default for anything else. `None` until the device has read the notebook and the timetable,
 * so the screen doesn't change as it appears.
 */
export const screen = Atom.family((accountId: string) =>
  Atom.family((requested: string) =>
    Atom.make((get): Option.Option<Screen> => {
      const current = get(HomeworkState.screen(accountId));
      const now = AsyncResult.value(get(DeviceStatus.now));

      if (Option.isNone(current) || Option.isNone(now)) return Option.none();

      const { today, offline, disconnected } = current.value;
      // Empty while the notebook is locked, as on the Übersicht.
      const homework = Option.match(current.value.reading, {
        onNone: () => [],
        onSome: (value) => value.homework,
      });
      const opening = Timetable.schoolWeek(today);
      const monday = Option.getOrElse(CivilTime.mondayOf(requested), () => opening);
      // The device's lessons from the earlier Monday on tell whether the school has a timetable.
      const from = CivilTime.order(monday, opening) < 0 ? monday : opening;
      const timetable = get(TimetableState.reading(accountId)(CivilTime.format(from)));

      if (AsyncResult.isInitial(timetable)) return Option.none();

      const held = Option.flatten(AsyncResult.value(timetable));
      const weekId = CivilTime.isoWeek(monday);

      const grid = Option.flatMap(held, (reading): Option.Option<Grid> => {
        if (reading.plan.coveredUntil === undefined && reading.plan.lessons.length === 0) {
          return Option.none();
        }

        const moment = CivilTime.momentIn(now.value, reading.timeZone);
        const shown = Timetable.week(reading.plan, monday);

        return Option.some({
          week: WeekItem.week(shown, reading.names, moment, homework),
          days: shown.columns.map((_, index) =>
            WeekItem.day(shown, index, reading.names, moment, homework),
          ),
          stand: AgendaItem.staleStand(
            reading.observedAt,
            now.value,
            reading.timeZone,
            disconnected,
          ),
        });
      });

      // Monday to Friday, and Saturday when a lesson falls on it.
      const days = Option.match(grid, { onNone: () => 5, onSome: ({ week }) => week.days.length });

      const label = Option.flatMap(held, (reading) =>
        Option.fromNullishOr(reading.weekLabels.get(weekId)),
      );

      return Option.some({
        week: {
          previous: CivilTime.isoWeek(CivilTime.addDays(monday, -7)),
          next: CivilTime.isoWeek(CivilTime.addDays(monday, 7)),
        },
        current: CivilTime.order(monday, opening) === 0,
        heading: WeekItem.heading(monday, days),
        chips: WeekItem.chips(monday, Option.getOrUndefined(label)),
        offline,
        grid,
      });
    }),
  ),
);
