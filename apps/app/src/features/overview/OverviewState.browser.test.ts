import { expect, it } from "@effect/vitest";
import { CivilTime, Homework, Notebook, NotebookProfile } from "@stu/core";
import { SyncClient, SyncQuery } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";

// The home reads the first start's query for the name and the homework query for the panel. Each
// runs again for a write to what it reads and for nothing else, on the app's own engine.

const accountId = "reads-lena";

const notebook = Notebook.Id.make("nb-lena");

const homeworkId = Homework.Id.make("1b4e28ba-2fa1-41d2-883f-0016d3cca427");

const lena = Schema.decodeSync(NotebookProfile.DisplayName)("Lena");

const today = Schema.decodeSync(CivilTime.PlainDate)("2026-11-16");

/**
 * An engine that stays offline, with a notebook at a school, one homework and one refused change,
 * as a pull leaves them.
 */
const seed = Effect.gen(function* () {
  yield* Effect.flatMap(SyncClient.Service, (sync) => sync.setOffline(true));
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into sync_space (id, kind, role, version) values
      ('nb-lena', 'notebook', 'owner', 1), ('demo', 'school', 'reader', 1)
  `;

  yield* sql`
    insert into base_row (space, tbl, id, version, data) values
      ('nb-lena', 'Notebook', 'nb-lena', 1, '{"schoolId":"demo"}'),
      ('demo', 'School', 'demo', 1, '{"name":"Demo-Gymnasium","timeZone":"Europe/Berlin"}'),
      ('nb-lena', 'Homework', ${homeworkId}, 1, '{"courseId":"c-1","title":"Vokabeln","dueOn":"2026-11-20"}')
  `;

  yield* sql`
    insert into sync_rejected_command (client_id, mutation_id, name, version, args, at, reason)
    values ('client-old', 7, 'homework.create', 1, '{}', 0, '{"_tag":"Sync.NotMember","space":"nb-tom"}')
  `;
});

/** The refused changes the home's panel lists. */
const refusalsOf = (reading: Option.Option<Option.Option<HomeworkState.Reading>>) =>
  Option.match(Option.flatten(reading), { onNone: () => [], onSome: (each) => each.refusals });

/** `query`, counting its runs. Reactivity starts a run inside the write that invalidates it. */
const counted = <A, E>(query: SyncQuery.SyncQuery<void, A, E>) => {
  const runs = { count: 0 };

  const each: SyncQuery.SyncQuery<void, A, E> = {
    keys: query.keys,
    run: () =>
      Effect.suspend(() => {
        runs.count += 1;

        return query.run();
      }),
  };

  return { runs, query: each };
};

it.effect("the home's queries run again for writes to what they read, and only for those", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

    const runtime = Atom.runtime(AccountEngine.app(accountId));
    registry.mount(runtime);

    const onEngine = <A, E>(
      effect: Effect.Effect<A, E, SyncClient.Service | SqlClient.SqlClient>,
    ) => AtomRegistry.getResult(registry, runtime.atom(effect), { suspendOnWaiting: true });

    yield* onEngine(seed);

    const onboarding = counted(OnboardingState.query);
    const homework = counted(HomeworkState.query);

    const mounted = <A, E>(query: SyncQuery.SyncQuery<void, A, E>) => {
      const atom = SyncQuery.family(runtime, query)();
      registry.mount(atom);

      return Effect.as(AtomRegistry.getResult(registry, atom), atom);
    };

    /** Waits until `atom` shows `shown`, which also means the run that read it has ended. */
    const until = <A, E>(
      atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
      shown: (value: A) => boolean,
    ) => AtomRegistry.toStreamResult(registry, atom).pipe(Stream.filter(shown), Stream.runHead);

    const firstStart = yield* mounted(onboarding.query);
    const panel = yield* mounted(homework.query);

    const runs = () => ({ onboarding: onboarding.runs.count, homework: homework.runs.count });

    expect(runs()).toEqual({ onboarding: 1, homework: 1 });

    yield* onEngine(
      Effect.flatMap(SyncClient.Service, (sync) =>
        sync.mutate(NotebookProfile.set, {
          notebook,
          displayName: lena,
          adult: false,
        }),
      ),
    );

    expect(runs(), "after the profile").toEqual({ onboarding: 2, homework: 1 });

    yield* onEngine(
      Effect.flatMap(SyncClient.Service, (sync) =>
        sync.mutate(Homework.setDone, {
          notebook,
          id: homeworkId,
          doneOn: today,
        }),
      ),
    );

    expect(runs(), "after a homework").toEqual({ onboarding: 2, homework: 2 });

    // A run that is still going takes a new invalidation as one more run once it ends, so the
    // counts below are exact only once both screens show the writes above.
    yield* until(
      firstStart,
      (now) => now._tag === "Ready" && now.snapshot.profile.displayName === lena,
    );

    const [refused] = refusalsOf(
      yield* until(panel, (now) =>
        Option.exists(now, (reading) =>
          reading.homework.some((each) => each.id === homeworkId && each.doneOn !== undefined),
        ),
      ),
    );

    expect(refused?.name).toBe(Homework.create.name);

    if (refused !== undefined) {
      yield* onEngine(Effect.flatMap(SyncClient.Service, (sync) => sync.dismiss(refused)));
    }

    expect(runs(), "after dismissing a refusal").toEqual({ onboarding: 3, homework: 3 });

    yield* until(panel, (now) => refusalsOf(Option.some(now)).length === 0);
  }).pipe(Effect.scoped),
);
