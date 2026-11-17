import { assert, it } from "@effect/vitest";
import { Notebook, NotebookProfile } from "@stu/core";
import { SyncClient } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";

import { SessionStore } from "../auth/SessionStore.ts";
import { Device } from "../device/Device.ts";
import { AccountEngine } from "./AccountEngine.ts";
import { Forgetting } from "./Forgetting.ts";
import { Layers } from "./Layers.ts";

const isSignedOut = Schema.is(AccountEngine.SignedOut);

const lena = Schema.decodeSync(NotebookProfile.DisplayName)("Lena");

const signedIn = (accountId: string) => ({
  accountId,
  token: Redacted.make(`token-${accountId}`),
  demo: false,
});

const engines = (device: string) =>
  AccountEngine.engines.pipe(
    Layer.provideMerge(SessionStore.layer),
    Layer.provideMerge(Layers.device({ name: device })),
  );

/** What sign-out deletes of an account the device keeps, ending with its session. */
const erase = (accountId: string) =>
  Layers.forget(
    accountId,
    Effect.flatMap(SessionStore.Service, (store) => store.forget),
  );

const notebook = Notebook.Id.make("nb-lena");

/** Lena's engine, offline, with her notebook as a pull leaves it, so she can write to it. */
const lenasEngine = Effect.gen(function* () {
  const sessions = yield* SessionStore.Service;
  const engines = yield* AccountEngine.Engines;

  yield* sessions.signedIn(signedIn("lena"), false);
  const engine = yield* engines.context("lena");
  const sync = Context.get(engine, SyncClient.Service);
  const sql = Context.get(engine, SqlClient.SqlClient);

  yield* sync.setOffline(true);
  yield* sql`insert into sync_space (id, kind, role, version) values (${notebook}, 'notebook', 'owner', 1)`;
  yield* sql`insert into base_row (space, tbl, id, version, data) values (${notebook}, 'Notebook', ${notebook}, 1, '{"schoolId":"demo"}')`;

  return sync;
});

const nameLena = (sync: SyncClient.Interface) =>
  sync.mutate(NotebookProfile.set, { notebook, displayName: lena, adult: false });

/** The commands the account's engine still has to send, from a new start of it. */
const unsentOf = (accountId: string) =>
  Effect.flatMap(AccountEngine.Engines, (engines) =>
    Effect.flatMap(
      engines.context(accountId),
      (context) => Context.get(context, SyncClient.Service).status.get,
    ),
  );

// The engine picks the account's storage when it opens: on disk only for a session the device
// keeps, so a public computer's account writes nothing that outlives it. Without a session there is
// no engine, as after sign-out.
it.effect("opens an account's engine where its session chose, and none without one", () =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;

    const inMemory = (accountId: string) =>
      Effect.map(engines.context(accountId), (context) =>
        Context.get(context, Device.PublicComputer),
      );

    yield* sessions.signedIn(signedIn("lena"), false);

    const kept = yield* inMemory("lena");
    const withoutSession = yield* Effect.flip(inMemory("tom"));

    yield* engines.forget("lena", Option.none(), erase("lena"));
    yield* sessions.signedIn(signedIn("tom"), true);

    const publicComputer = yield* inMemory("tom");

    yield* engines.forget("tom", Option.none(), sessions.forget);

    assert.deepStrictEqual(
      { kept, withoutSession: withoutSession._tag, publicComputer },
      { kept: false, withoutSession: "AccountEngine.SignedOut", publicComputer: true },
    );
  }).pipe(Effect.provide(engines("engines"))),
);

// A screen still on the way out asks for the engine while sign-out deletes the account. Answering
// it would open the database again, and an open database can't be deleted.
it.effect("signs out while a screen asks for the engine, which stays off", () =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;
    const asked = yield* Deferred.make<Exit.Exit<unknown, unknown>>();

    yield* sessions.signedIn(signedIn("lena"), false);
    yield* engines.context("lena");

    const signedOut = yield* Effect.exit(
      engines.forget(
        "lena",
        Option.none(),
        Effect.andThen(
          Effect.forkScoped(
            Effect.flatMap(Effect.exit(engines.context("lena")), (exit) =>
              Deferred.succeed(asked, exit),
            ),
          ),
          erase("lena"),
        ),
      ),
    );

    const answer = yield* Deferred.await(asked);

    assert.isTrue(Exit.isSuccess(signedOut), "sign-out finished");
    assert.deepStrictEqual(
      Option.map(Exit.findErrorOption(answer), isSignedOut),
      Option.some(true),
    );
  }).pipe(Effect.scoped, Effect.provide(engines("engines-leaving"))),
);

// "Abmelden" showed the changes it would lose before its question, by their newest mutation id. One
// saved after it is lost only when the question asks again with it.
it.effect("refuses to sign out when a change was saved after the question, and keeps it", () =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;
    const sync = yield* lenasEngine;

    // The question showed none, then the name was saved.
    yield* nameLena(sync);

    const refused = yield* Effect.flip(engines.forget("lena", Option.some(0), erase("lena")));
    const still = yield* unsentOf("lena");

    yield* engines.forget("lena", Option.some(1), erase("lena"));

    assert.deepStrictEqual(
      { refused: refused._tag, waiting: still.waiting, signedIn: yield* sessions.current },
      { refused: "AccountEngine.MoreUnsent", waiting: 1, signedIn: Option.none() },
    );
  }).pipe(Effect.provide(engines("engines-unsent"))),
);

// A refusal's write goes on after the screen that caused it unmounts, and stops at sign-out.
it.effect("work in the engine's scope outlives the screen that waits for it, not the engine", () =>
  Effect.gen(function* () {
    const engine = yield* Scope.make();

    const inEngine = <A, E>(effect: Effect.Effect<A, E>) =>
      AccountEngine.inEngineScope(effect).pipe(
        Effect.provideService(AccountEngine.EngineScope, engine),
      );

    const started = yield* Deferred.make<void>();
    const gate = yield* Deferred.make<void>();
    const written = yield* Deferred.make<void>();

    const screen = yield* Effect.forkChild(
      inEngine(
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(gate)),
          Effect.andThen(Deferred.succeed(written, undefined)),
        ),
      ),
    );

    yield* Deferred.await(started);
    yield* Fiber.interrupt(screen);
    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(written);

    const pending = yield* Deferred.make<void>();

    const late = yield* Effect.forkChild(
      inEngine(Effect.andThen(Deferred.succeed(pending, undefined), Effect.never)),
    );

    yield* Deferred.await(pending);
    yield* Scope.close(engine, Exit.void);

    assert.isTrue(Exit.hasInterrupts(yield* Fiber.await(late)));
  }),
);

// A write already under way when "Trotzdem abmelden" lands commits while sign-out stops the
// engine. It finishes first and counts, rather than being deleted unasked.
it.effect("refuses to sign out when a change commits while it stops the engine", () =>
  Effect.gen(function* () {
    const engines = yield* AccountEngine.Engines;
    const sync = yield* lenasEngine;

    // Starts at once, so it holds the engine's writes before sign-out asks for them.
    const saving = yield* Effect.forkChild(nameLena(sync), { startImmediately: true });

    const refused = yield* Effect.flip(engines.forget("lena", Option.some(0), erase("lena")));
    const saved = yield* Fiber.await(saving);
    const still = yield* unsentOf("lena");

    assert.deepStrictEqual(
      { refused: refused._tag, saved: Exit.isSuccess(saved), waiting: still.waiting },
      { refused: "AccountEngine.MoreUnsent", saved: true, waiting: 1 },
    );
  }).pipe(Effect.provide(engines("engines-committing"))),
);

// A screen on its way out still holds the engine and writes after sign-out took it. The write fails
// at once, rather than waiting on a closed database or landing in one.
it.effect("fails a write that reaches the engine after sign-out stopped it", () =>
  Effect.gen(function* () {
    const engines = yield* AccountEngine.Engines;
    const sync = yield* lenasEngine;

    yield* engines.forget("lena", Option.some(0), erase("lena"));

    const late = yield* Effect.exit(nameLena(sync));

    assert.isTrue(Result.getOrElse(Result.map(Exit.findDefect(late), isSignedOut), () => false));
  }).pipe(Effect.provide(engines("engines-late-write"))),
);

// Past the note, a sign-out that stopped halfway keeps the account's engine off, even with its
// session still there: a new engine would write to a database the next start deletes.
it.effect("keeps the engine off once a sign-out began, until it finishes", () =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;

    yield* sessions.signedIn(signedIn("lena"), false);
    yield* engines.context("lena");

    yield* Effect.exit(
      engines.forget(
        "lena",
        Option.none(),
        Forgetting.forget("lena", () => Effect.die("the app ended"), sessions.forget),
      ),
    );

    const refused = yield* Effect.flip(engines.context("lena"));

    assert.isTrue(Option.isSome(yield* sessions.current), "the session stayed");
    assert.strictEqual(refused._tag, "AccountEngine.SignedOut");

    yield* Effect.flatMap(Forgetting.Service, (unfinished) => unfinished.finish);
    yield* sessions.forget;
  }).pipe(Effect.provide(engines("engines-halfway"))),
);
