import { assert, it } from "@effect/vitest";
import { CivilTime, Course, Homework, Notebook } from "@stu/core";
import { Refusal } from "@stu/sync";
import { SyncClient } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
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

/** Signs `accountId` in on a public computer, so its engine keeps everything in memory. */
const signedIn = (accountId: string) =>
  Effect.flatMap(SessionStore.Service, (store) =>
    store.signedIn({ accountId, token: Redacted.make(`token-${accountId}`), demo: false }, true),
  );

/**
 * A fresh account on this device whose engine stays offline and holds no notebook, so the device
 * refuses every tick and delete itself.
 */
const refusingAccount = (accountId: string) =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

    const result = <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) =>
      AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });

    yield* result(Atom.runtime(AccountEngine.device).atom(signedIn(accountId)));

    const engine = Atom.runtime(AccountEngine.app(accountId));
    yield* result(engine.atom(Effect.flatMap(SyncClient.Service, (sync) => sync.setOffline(true))));

    return { registry, result };
  });

const isNotToggled = Schema.is(HomeworkState.NotToggled);

const homeworkA = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const homeworkB = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

// A week offline ends with several changes refused at once; each keeps its card.
it.effect("refusals that arrive together all stay, and cards dismissed together all go", () =>
  Effect.gen(function* () {
    const accountId = "refusals-together";
    const { registry, result } = yield* refusingAccount(accountId);
    const setDone = HomeworkState.setDone(accountId);
    const remove = HomeworkState.remove(accountId);

    registry.set(setDone, { notebook, id: homeworkA, doneOn: dueOn });
    registry.set(remove, { notebook, id: homeworkB });
    yield* Effect.all([Effect.flip(result(setDone)), Effect.flip(result(remove))], {
      concurrency: "unbounded",
    });

    // A stream that keeps reading, so its first value is enough.
    const refusals = HomeworkState.localRefusals(accountId);
    const leave = registry.mount(refusals);
    const held = yield* AtomRegistry.getResult(registry, refusals);

    assert.deepStrictEqual(held.map((each) => `${each._tag} ${each.id}`).sort(), [
      `HomeworkState.NotDeleted ${homeworkB}`,
      `HomeworkState.NotToggled ${homeworkA}`,
    ]);
    assert.isTrue(held.some(isNotToggled));

    const dismiss = HomeworkState.dismissLocal(accountId);

    for (const each of held) registry.set(dismiss, each);

    const left = yield* AtomRegistry.toStreamResult(registry, refusals).pipe(
      Stream.filter((each) => each.length === 0),
      Stream.runHead,
    );

    assert.isTrue(Option.isSome(left));
    leave();
  }),
);

// Sign-out stops the account's engine and deletes its database; a public computer's account lives
// in memory, so stopping its engine is all of that. Signing in again opens a fresh one.
it.effect("signing in again after a sign-out shows no refusal from before, and no error", () =>
  Effect.gen(function* () {
    const accountId = "refusals-sign-out";
    const { registry, result } = yield* refusingAccount(accountId);

    const setDone = HomeworkState.setDone(accountId);
    registry.set(setDone, { notebook, id: homeworkA, doneOn: dueOn });
    yield* Effect.flip(result(setDone));

    const refusals = HomeworkState.localRefusals(accountId);
    const leave = registry.mount(refusals);
    assert.strictEqual((yield* AtomRegistry.getResult(registry, refusals)).length, 1);
    leave();

    yield* result(
      Atom.runtime(AccountEngine.device).atom(
        Effect.flatMap(SessionStore.Service, (store) =>
          Effect.andThen(
            AccountEngine.forget(accountId, Option.none(), store.forget),
            signedIn(accountId),
          ),
        ),
      ),
    );

    assert.deepStrictEqual(yield* AtomRegistry.getResult(registry, refusals), []);
  }),
);
