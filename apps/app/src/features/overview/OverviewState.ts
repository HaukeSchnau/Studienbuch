import type { CivilTime, Notebook } from "@stu/core";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { type Outbox, SyncClient } from "@stu/sync/client";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { Refused } from "../homework/Refused.ts";
import { KeysState } from "../keys/KeysState.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";

// What the Übersicht shows, put together from the account's atoms, so its screen only draws.

export * as OverviewState from "./OverviewState.ts";

export interface Overview {
  /** The first name from the encrypted profile, which a locked device can't read. */
  readonly name: Option.Option<string>;
  readonly today: CivilTime.PlainDate;
  /** The device doesn't hold the notebook's key: it is `Locked`, or `Offline` or `NotHere`. */
  readonly locked: boolean;
  /** `Some` with the changes that wait for the server while the device has no connection. */
  readonly offline: Option.Option<{ readonly waiting: number }>;
  /** `None` until the device has read the notebook, or when the account has none. */
  readonly panel: Option.Option<Panel>;
}

/** The notebook's homework as the panel shows it, and the refused changes above it. */
export interface Panel {
  readonly notebook: Notebook.Id;
  /**
   * `undefined` until the device holds the notebook's key. Without it the homework rows stay
   * sealed, and an empty list would say there is no homework.
   */
  readonly items: ReadonlyArray<HomeworkItem.Item> | undefined;
  readonly refusals: ReadonlyArray<{ readonly rejected: Outbox.Rejected; readonly change: string }>;
  readonly titles: ReadonlyMap<string, string>;
}

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

/**
 * Whether the engine is offline, and how many changes wait for the server. The engine passes
 * through "offline" between its attempts to connect, so the flag follows only after 2 seconds.
 */
const connection = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(
      Effect.map(SyncClient.Service, (sync) =>
        Stream.zipLatest(
          sync.status.changes.pipe(
            Stream.map((status) => status.connection !== "online"),
            Stream.changes,
            Stream.debounce(Duration.seconds(2)),
          ),
          sync.status.changes.pipe(
            Stream.map((status) => status.waiting),
            Stream.changes,
          ),
        ),
      ),
    ),
  ),
);

/**
 * The Übersicht of the account, `None` until the device has read who the student is, so the
 * greeting never shows without the name first.
 */
export const overview = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<Overview> => {
    const onboarding = AsyncResult.value(get(OnboardingState.reading(accountId)));
    const reading = Option.flatten(AsyncResult.value(get(HomeworkState.reading(accountId))));

    const today = AsyncResult.value(
      get(
        HomeworkState.today(
          Option.match(reading, {
            onNone: () => HomeworkState.fallbackTimeZone,
            onSome: (r) => r.timeZone,
          }),
        ),
      ),
    );

    if (Option.isNone(onboarding) || Option.isNone(today)) return Option.none();

    const offline = Option.flatMap(
      AsyncResult.value(get(connection(accountId))),
      ([disconnected, waiting]) => (disconnected ? Option.some({ waiting }) : Option.none()),
    );

    // `None` until the device knows where it stands with the notebook's key.
    const unlocked = Option.map(
      AsyncResult.value(get(KeysState.status(accountId))),
      (status) => status._tag === "Unlocked",
    );

    return Option.some({
      name:
        onboarding.value._tag === "Ready"
          ? Option.fromNullishOr(onboarding.value.snapshot.profile.displayName)
          : Option.none(),
      today: today.value,
      locked: Option.contains(unlocked, false),
      offline,
      panel: Option.map(reading, (value) => {
        const titles = new Map(value.homework.map((each) => [each.id, each.title]));

        return {
          notebook: value.notebook,
          items: Option.contains(unlocked, true)
            ? HomeworkItem.panel(
                // Online, a change settles within a second, so its marker would only flicker.
                value.homework.map((each) => ({
                  ...each,
                  waiting: each.waiting && Option.isSome(offline),
                })),
                today.value,
              )
            : undefined,
          refusals: value.refusals.map((rejected) => ({
            rejected,
            change: Refused.change(rejected, titles),
          })),
          titles,
        };
      }),
    });
  }),
);
