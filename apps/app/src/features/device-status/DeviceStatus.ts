import { CivilTime, Notebook, School } from "@stu/core";
import { DeviceDatabase, DeviceSchema, SyncClient, SyncQuery } from "@stu/sync/client";
import { eq } from "drizzle-orm";
import * as Clock from "effect/Clock";
import * as Cron from "effect/Cron";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";
import { Account } from "../account/Account.ts";
import { AccountState } from "../account/AccountState.ts";
import { KeysState } from "../keys/KeysState.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";
import { Offline } from "./Offline.ts";

// What every screen of the account shows around its content: today and now at the school, whether
// the device holds the notebook's key, and whether it is offline with changes waiting.

export * as DeviceStatus from "./DeviceStatus.ts";

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

const everyMinute = Cron.make({ minutes: [], hours: [], days: [], months: [], weekdays: [] });

/** The device's clock in epoch milliseconds, read at once and then as each minute begins. */
const minutes = Stream.concat(
  Stream.make(undefined),
  Stream.fromSchedule(Schedule.cron(everyMinute)),
).pipe(Stream.mapEffect(() => Clock.currentTimeMillis));

/** The one clock every account's `now` and `today` read, so they move on together. */
const clock = Atom.make(minutes);

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  school: DeviceSchema.decodeView(School.Row),
};

/** The row of the notebook's school, which holds its time zone. `None` without either. */
const readSchool = Effect.gen(function* () {
  const db = yield* DeviceDatabase.make;
  const [notebook] = yield* Effect.flatMap(db.select().from(Device.Notebook), decode.notebook);

  if (notebook === undefined) return Option.none<School.Row>();

  const [school] = yield* Effect.flatMap(
    db.select().from(Device.School).where(eq(Device.School.space, notebook.schoolId)),
    decode.school,
  );

  return Option.fromUndefinedOr(school);
});

const schoolQuery = SyncQuery.read({
  tables: [Notebook.Row, School.Row],
  run: () => readSchool.pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

const school = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), schoolQuery)(),
);

/**
 * Now at the account's school (`School.now`), read again as each minute begins, so "Noch 50
 * Minuten" counts down on the minute. Until the device has read the school's row, it counts as
 * `School.now` does without one. `None` until the clock is read.
 */
export const now = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<School.Now> => {
    const row = Option.flatten(AsyncResult.value(get(school(accountId))));

    return Option.map(AsyncResult.value(get(clock)), (instant) =>
      School.now(Option.getOrUndefined(row), instant),
    );
  }),
);

/**
 * Today at the account's school, from `now`. It changes only at the school's midnight, so a screen
 * that shows only dates draws again then, and "Bis morgen" turns into "Heute fällig".
 */
export const today = Atom.family((accountId: string) =>
  Atom.make((get) => Option.map(get(now(accountId)), (at) => at.date)).pipe(
    Atom.withEquality(
      Option.makeEquivalence<CivilTime.PlainDate>((a, b) => CivilTime.order(a, b) === 0),
    ),
  ),
);

export interface Status {
  /**
   * The device doesn't hold the notebook's key: it is `Locked`, `Offline` or `NotHere`, or its status
   * failed (`NotebookKeys.unlocked`).
   */
  readonly locked: boolean;
  /**
   * The device holds the notebook's key. Until then the notebook's rows stay sealed, and an empty
   * list would say there is nothing, so the screens show none.
   */
  readonly readable: boolean;
  /** The engine has no connection (`Offline.shown`), whether or not the session has ended. */
  readonly disconnected: boolean;
  /**
   * `Some` with the changes that wait for the server while the device has no connection. Not while
   * the session has ended, which the account's notice says instead.
   */
  readonly offline: Option.Option<{ readonly waiting: number }>;
}

/** Whether the engine is offline (`Offline.shown`), and how many changes wait for the server. */
const connection = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(
      Effect.map(SyncClient.Service, (sync) =>
        Stream.zipLatest(
          Offline.shown(
            sync.status.changes.pipe(Stream.map((status) => status.connection !== "online")),
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

/** The notebook's key and the connection of the account's device. */
export const status = Atom.family((accountId: string) =>
  Atom.make((get): Status => {
    const disconnected = Option.filter(
      AsyncResult.value(get(connection(accountId))),
      ([offline]) => offline,
    );

    const ended = Account.access(get(AccountState.current)) === "ended";

    const unlocked = NotebookKeys.unlocked(get(KeysState.status(accountId)));

    return {
      locked: Option.contains(unlocked, false),
      readable: Option.contains(unlocked, true),
      disconnected: Option.isSome(disconnected),
      offline: ended ? Option.none() : Option.map(disconnected, ([, waiting]) => ({ waiting })),
    };
  }),
);
