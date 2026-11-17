import { assert, it } from "@effect/vitest";
import { CivilTime, Course, Homework, Notebook, School } from "@stu/core";
import { Refusal } from "@stu/sync";
import { SyncClient } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { HomeworkInput } from "./HomeworkInput.ts";
import { HomeworkState } from "./HomeworkState.ts";
import { Refused } from "./Refused.ts";

// Browser tests only because HomeworkState's engine imports need a browser: what they test isn't
// tied to one.

const notebook = Notebook.Id.make("nb-lena");
const dueOn = Schema.decodeSync(CivilTime.PlainDate)("2026-11-20");

// The args as the outbox stores them: encoded by the mutator's own JSON codec.
const encodeCreate = Schema.encodeSync(Homework.create.args);
const encodeNotMember = Schema.encodeSync(Refusal.NotMember);

/** What a device held before its notebook locked: one homework and one refused new one. */
const held: HomeworkState.Reading = {
  notebook,
  timeZone: School.defaultTimeZone,
  homework: [
    {
      id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
      title: "Vokabeln lernen",
      description: "Unit 4",
      dueOn,
      course: "MA23",
      courseId: "c-1",
      subject: Option.none(),
      waiting: true,
    },
  ],
  refusals: [
    {
      clientId: "client-old",
      mutationId: 7,
      name: Homework.create.name,
      version: 1,
      args: encodeCreate({
        notebook,
        id: Homework.Id.make("6f9619ff-8b86-4011-b42d-00c04fc964ff"),
        courseId: Course.Id.make("c-1"),
        title: Schema.decodeSync(Homework.Title)("Referat vorbereiten"),
        dueOn,
      }),
      at: 0,
      reason: encodeNotMember(new Refusal.NotMember({ space: notebook })),
    },
  ],
  terms: [],
  enrollments: [],
  courses: new Map(),
};

it("a locked notebook shows no homework title, and its refusals return with the key", () => {
  const titles = ["Vokabeln lernen", "Unit 4", "Referat vorbereiten"];
  const locked = JSON.stringify(HomeworkState.shown(held, { readable: false, disconnected: true }));
  const unlocked = HomeworkState.shown(held, { readable: true, disconnected: true });

  for (const title of titles) assert.notInclude(locked, title);
  assert.deepStrictEqual(unlocked.refusals, held.refusals);
  assert.deepStrictEqual(unlocked.homework, held.homework);
});

/** A store in memory whose writes to the new homework's draft fail, as a full disk would. */
const fullForCreated = Layer.effect(
  KeyValueStore.KeyValueStore,
  Effect.map(KeyValueStore.KeyValueStore, (store) =>
    KeyValueStore.make({
      ...store,
      set: (key, value) =>
        key === "homework-touched-created"
          ? Effect.fail(
              new KeyValueStore.KeyValueStoreError({ message: "full", method: "set", key }),
            )
          : store.set(key, value),
    }),
  ),
).pipe(Layer.provide(KeyValueStore.layerMemory));

it.layer(fullForCreated)((it) => {
  it.effect("a draft the new homework's edit can't take stays in the add sheet", () =>
    Effect.gen(function* () {
      const drafts = KeyValueStore.toSchemaStore(
        yield* KeyValueStore.KeyValueStore,
        HomeworkInput.Draft,
      );

      const typed = { title: "Referat vorbereiten", description: "Folien bis Freitag" };

      yield* drafts.set("homework-touched-new", typed);
      yield* Effect.ignore(HomeworkState.moveStored("new", "created", typed));

      assert.deepStrictEqual(yield* drafts.get("homework-touched-new"), Option.some(typed));
    }),
  );
});

it.layer(KeyValueStore.layerMemory)((it) => {
  it.effect("a tick and a delete this device refused come back from the store as refusals", () =>
    Effect.gen(function* () {
      const stored = KeyValueStore.toSchemaStore(
        yield* KeyValueStore.KeyValueStore,
        HomeworkState.HeldRefusals,
      );

      const held = [
        new HomeworkState.NotToggled({ id: "a", done: true, reason: "Homework.NotFound" }),
        new HomeworkState.NotDeleted({ id: "b", reason: "Homework.NotFound" }),
      ];

      yield* stored.set("homework-local-refusals", held);
      const back = Option.getOrElse(yield* stored.get("homework-local-refusals"), () => []);

      assert.deepStrictEqual(back, held);
      assert.instanceOf(back[0], HomeworkState.NotToggled);
    }),
  );
});

it("a refusal about homework another device deleted keeps its card, and none shows while locked", () => {
  const titles = new Map([["vokabeln", "Vokabeln lernen"]]);

  const held = [
    new HomeworkState.NotToggled({
      id: "deleted-elsewhere",
      done: true,
      reason: "Homework.NotFound",
    }),
    new HomeworkState.NotDeleted({ id: "vokabeln", reason: "Homework.NotFound" }),
  ];

  assert.deepStrictEqual(
    Refused.local(held, titles, true).map(({ change }) => change),
    ["Abgehakt: eine Hausaufgabe", "Gelöscht: Vokabeln lernen"],
  );

  assert.deepStrictEqual(Refused.local(held, titles, false), []);
});

// Sign-out closes the account's engine and deletes its database; an account without a kept session
// lives in memory, so closing its engine is all of that. Signing in again opens a fresh one.
it.effect("signing in again after a sign-out shows no refusal from before, and no error", () =>
  Effect.gen(function* () {
    const accountId = "refusals-sign-out";
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

    const result = <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
      AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });

    const engine = Atom.runtime(AccountEngine.app(accountId));
    yield* result(engine.atom(Effect.flatMap(SyncClient.Service, (sync) => sync.setOffline(true))));

    // The device holds no such notebook, so it refuses the tick itself.
    const setDone = HomeworkState.setDone(accountId);
    registry.set(setDone, { notebook, id: "6f9619ff-8b86-4011-b42d-00c04fc964ff", doneOn: dueOn });
    yield* Effect.flip(result(setDone));

    // A stream that keeps reading, so its first value is enough.
    const refusals = HomeworkState.localRefusals(accountId);
    const leave = registry.mount(refusals);
    assert.strictEqual((yield* AtomRegistry.getResult(registry, refusals)).length, 1);
    leave();

    yield* result(Atom.runtime(AccountEngine.device).atom(AccountEngine.close(accountId)));

    assert.deepStrictEqual(yield* AtomRegistry.getResult(registry, refusals), []);
  }),
);
