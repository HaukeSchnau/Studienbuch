import { expect, it } from "@effect/vitest";
import { CivilTime, Homework, Notebook, NotebookProfile } from "@stu/core";
import { SyncClient, SyncQuery } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

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

/** An engine that stays offline, with a notebook at a school and one homework, as a pull leaves it. */
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
});

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

it.effect("the home's queries run again only for writes to what they read", () =>
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

      return AtomRegistry.getResult(registry, atom);
    };

    yield* mounted(onboarding.query);
    yield* mounted(homework.query);

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
  }).pipe(Effect.scoped),
);
