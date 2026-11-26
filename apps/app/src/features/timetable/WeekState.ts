import { CivilTime, Timetable } from "@stu/core";
import { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import { WeekItem } from "@stu/domain-ui/timetable/WeekItem";
import * as Data from "effect/Data";
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

/** What the card under the hero shows. */
export type Card = Data.TaggedEnum<{
  /** The device is still reading a week before the one it opens. */
  Reading: {};
  /** A school without a timetable: no lessons on the device and no Stand. */
  NoTimetable: {};
  Week: Grid;
}>;

export const Card = Data.taggedEnum<Card>();

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
  readonly card: Card;
}

/**
 * Meine Woche of the account for `requested`, an ISO week such as `2026-W48`, or the week it opens
 * by default for anything else. `None` until the device has read the notebook and the timetable
 * from the week it opens on, so the screen doesn't change as it appears. A week before that one
 * reads from its own Monday, and while it does, the hero stays and the card waits.
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
      const opened = get(TimetableState.reading(accountId)(CivilTime.format(opening)));

      if (AsyncResult.isInitial(opened)) return Option.none();

      const timetable =
        CivilTime.order(monday, opening) < 0
          ? get(TimetableState.reading(accountId)(CivilTime.format(monday)))
          : opened;

      const card = AsyncResult.isInitial(timetable)
        ? Card.Reading()
        : Option.match(Option.flatten(AsyncResult.value(timetable)), {
            onNone: () => Card.NoTimetable(),
            onSome: (reading): Card => {
              // The device's lessons from the earlier Monday on tell whether there is a timetable.
              if (reading.plan.coveredUntil === undefined && reading.plan.lessons.length === 0) {
                return Card.NoTimetable();
              }

              const moment = CivilTime.momentIn(now.value, reading.timeZone);
              const shown = Timetable.week(reading.plan, monday);

              return Card.Week({
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
            },
          });

      // Monday to Friday, and Saturday when a lesson falls on it.
      const days = card._tag === "Week" ? card.week.days.length : 5;

      // The school's rows are read whole, so the opening week's read has every label.
      const label = Option.flatMap(Option.flatten(AsyncResult.value(opened)), (reading) =>
        Option.fromNullishOr(reading.weekLabels.get(CivilTime.isoWeek(monday))),
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
        card,
      });
    }),
  ),
);
