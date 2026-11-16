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

// A `SyncQuery` names its tables and the engine queries it runs, which passes.
export const day = SyncQuery.read({
  tables: [Lesson.Row],
  queries: [SyncClient.refusals],
  run: () => read,
});
