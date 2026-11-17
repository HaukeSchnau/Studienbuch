import { Lesson } from "@stu/core";
import { SyncClient, SyncQuery } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";

const read = Effect.succeed([]);

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: the engine's key list
const everything = Object.values(SyncClient.keys);

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: a stream with hand-picked keys
export const lessons = Reactivity.stream(read, ["Lesson", ...everything]);

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: an atom with hand-picked keys
export const week = Atom.make(read).pipe(Atom.withReactivity(["Lesson"]));

/** Effect's `SqlClient`, as far as these reads use it. Every import in a fixture is untyped. */
declare const sql: {
  readonly reactive: (keys: ReadonlyArray<string>, effect: typeof read) => void;
  readonly reactiveMailbox: (keys: ReadonlyArray<string>, effect: typeof read) => void;
};

/** A `Reactivity` service, as a screen would get it with `yield* Reactivity.Reactivity`. */
declare const reactivity: {
  readonly stream: (keys: ReadonlyArray<string>, effect: typeof read) => void;
  readonly query: (keys: ReadonlyArray<string>, effect: typeof read) => void;
};

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: the SQL client's live query
export const fromSql = sql.reactive(["Lesson"], read);

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: its mailbox form
export const fromSqlMailbox = sql.reactiveMailbox(["Lesson"], read);

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: the service's stream
export const fromService = reactivity.stream(["Lesson"], read);

// oxlint-disable-next-line studienbuch/no-hand-rolled-live-query -- fixture: the service's query
export const fromServiceQuery = reactivity.query(["Lesson"], read);

// A `SyncQuery` names its tables and the engine queries it runs, which passes.
export const day = SyncQuery.read({
  tables: [Lesson.Row],
  queries: [SyncClient.refusals],
  run: () => read,
});
