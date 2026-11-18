import { CivilTime, type Notebook, Timetable } from "@stu/core";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { DeviceStatus } from "../device-status/DeviceStatus.ts";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { Onboarding } from "../onboarding/Onboarding.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";
import { TimetableState } from "../timetable/TimetableState.ts";

// What the Übersicht shows, put together from the account's atoms, so its screen only draws.

export * as OverviewState from "./OverviewState.ts";

export interface Overview extends HomeworkState.Screen {
  /** The first name from the encrypted profile, which a locked device can't read. */
  readonly name: Option.Option<string>;
  /** `None` until the device has read the notebook, or when the account has none. */
  readonly panel: Option.Option<Panel>;
  /** The lessons of the day the card shows. `None` when the device couldn't read them. */
  readonly agenda: Option.Option<Agenda>;
}

/** The notebook's homework as the panel shows it. */
export interface Panel {
  readonly notebook: Notebook.Id;
  /**
   * `undefined` until the device holds the notebook's key. Without it the homework rows stay
   * sealed, and an empty list would say there is no homework.
   */
  readonly items: ReadonlyArray<HomeworkItem.Item> | undefined;
}

/** The hero's line and the card, with the Stand in its foot once it is old. */
export interface Agenda extends AgendaItem.Agenda {
  readonly stand: AgendaItem.Stand | undefined;
}

/** The day `Timetable.shown` picks at `now`, in words, with the Stand once it is old. */
export const agenda = (
  held: TimetableState.Reading,
  now: number,
  disconnected: boolean,
): Agenda => {
  const moment = CivilTime.momentIn(now, held.timeZone);
  const shown = AgendaItem.agenda(Timetable.shown(held.plan, moment), held.names, moment);

  const stand = Option.flatMap(held.observedAt, (observedAt) =>
    Timetable.staleSince(observedAt, now, held.timeZone),
  ).pipe(Option.map((read) => AgendaItem.stand(read, moment.date, disconnected)));

  return {
    ...shown,
    stand: shown.card === undefined ? undefined : Option.getOrUndefined(stand),
  };
};

/**
 * The Übersicht of the account, `None` until the device has read who the student is and its
 * timetable, so neither the greeting nor the hero's line changes as the screen appears. A read that
 * failed shows it without the name, or without the lessons.
 */
export const overview = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<Overview> => {
    const name = Onboarding.greeting(get(OnboardingState.reading(accountId)));
    const current = get(HomeworkState.screen(accountId));
    const now = get(DeviceStatus.now);

    if (Option.isNone(name) || Option.isNone(current) || AsyncResult.isInitial(now)) {
      return Option.none();
    }

    const { today, readable, reading, disconnected } = current.value;
    // The week's lessons decide its free periods, so the read starts on its Monday.
    const monday = CivilTime.addDays(today, 1 - CivilTime.dayOfWeek(today));
    const timetable = get(TimetableState.reading(accountId)(CivilTime.format(monday)));

    if (AsyncResult.isInitial(timetable)) return Option.none();

    return Option.some({
      ...current.value,
      name: name.value,
      panel: Option.map(reading, (value) => ({
        notebook: value.notebook,
        items: readable ? HomeworkItem.panel(value.homework, today) : undefined,
      })),
      agenda: Option.flatMap(Option.flatten(AsyncResult.value(timetable)), (held) =>
        Option.map(AsyncResult.value(now), (millis) => agenda(held, millis, disconnected)),
      ),
    });
  }),
);
