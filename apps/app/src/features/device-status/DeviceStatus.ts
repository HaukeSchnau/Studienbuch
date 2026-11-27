import { CivilTime, Notebook, School } from "@stu/core";
import { DeviceDatabase, DeviceSchema, SyncClient, SyncQuery } from "@stu/sync/client";
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

// What every screen of the account shows around its content: today at the school, whether the
// device holds the notebook's key, and whether it is offline with changes waiting.

export * as DeviceStatus from "./DeviceStatus.ts";

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

const everyMinute = Cron.make({ minutes: [], hours: [], days: [], months: [], weekdays: [] });

/** The device's clock in epoch milliseconds, read at once and then as each minute begins. */
const clock = Atom.make(
  Stream.concat(Stream.make(undefined), Stream.fromSchedule(Schedule.cron(everyMinute))).pipe(
    Stream.mapEffect(() => Clock.currentTimeMillis),
  ),
);

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  school: DeviceSchema.decodeView(School.Row),
};

/** The row of the notebook's school, which holds its time zone. */
const readSchool = Effect.fn("DeviceStatus.readSchool")(function* () {
  const db = yield* DeviceDatabase.make;
  const [notebook] = yield* Effect.flatMap(db.select().from(Device.Notebook), decode.notebook);
  const schools = yield* Effect.flatMap(db.select().from(Device.School), decode.school);

  return Option.fromNullishOr(schools.find((row) => row.space === notebook?.schoolId));
});

const schoolQuery = SyncQuery.read({
  tables: [Notebook.Row, School.Row],
  run: () => readSchool().pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

const school = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), schoolQuery)(),
);

/**
 * Now at the account's school (`School.now`), from the one clock every screen reads, again as each
 * minute begins, so "Noch 50 Minuten" counts down on the minute. `None` until the device has read
 * its clock and looked for the school's row; a device without one counts in the default zone.
 */
export const now = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<School.Now> => {
    const held = get(school(accountId));

    if (AsyncResult.isInitial(held)) return Option.none();

    const row = Option.getOrUndefined(Option.flatten(AsyncResult.value(held)));

    return Option.map(AsyncResult.value(get(clock)), (at) => School.now(row, at));
  }),
);

/**
 * Today at the account's school, from `now`. It changes only at the school's midnight, so "Bis
 * morgen" turns into "Heute fällig" then on a screen that stays open, and nothing else redraws.
 */
export const today = Atom.family((accountId: string) =>
  Atom.make((get) => Option.map(get(now(accountId)), (current) => current.date)).pipe(
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
