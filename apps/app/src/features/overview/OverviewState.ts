import type { Notebook } from "@stu/core";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

import { HomeworkState } from "../homework/HomeworkState.ts";
import { Onboarding } from "../onboarding/Onboarding.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";

// What the Übersicht shows, put together from the account's atoms, so its screen only draws.

export * as OverviewState from "./OverviewState.ts";

export interface Overview extends HomeworkState.Status {
  /** The first name from the encrypted profile, which a locked device can't read. */
  readonly name: Option.Option<string>;
  /** `None` until the device has read the notebook, or when the account has none. */
  readonly panel: Option.Option<Panel>;
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

/**
 * The Übersicht of the account, `None` until the device has read who the student is, so the
 * greeting never shows without the name first. A read that failed shows it without the name.
 */
export const overview = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<Overview> => {
    const name = Onboarding.greeting(get(OnboardingState.reading(accountId)));
    const current = get(HomeworkState.status(accountId));

    if (Option.isNone(name) || Option.isNone(current)) return Option.none();

    const { today, readable, reading } = current.value;

    return Option.some({
      ...current.value,
      name: name.value,
      panel: Option.map(reading, (value) => ({
        notebook: value.notebook,
        items: readable ? HomeworkItem.panel(value.homework, today) : undefined,
      })),
    });
  }),
);
