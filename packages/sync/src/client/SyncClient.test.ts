import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as Scope from "effect/Scope";
import { Refusal } from "../protocol/Refusal.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";
import { Devices } from "./fixture/Devices.ts";
import { Notes } from "./fixture/Notes.ts";
import { NotesDevice } from "./fixture/NotesDevice.ts";
import { Outbox } from "./Outbox.ts";
import { SyncClient } from "./SyncClient.ts";

const engine = SyncClient.layer(Notes.schema).pipe(Layer.provideMerge(Devices.session));

type Services = SyncClient.Service | SqlClient.SqlClient | Reactivity.Reactivity | Scope.Scope;

/** Runs `body` on a fresh database of each SQLite build, with Lena's notebook and the engine. */
const onEachDevice = <E>(body: (driver: Devices.Driver) => Effect.Effect<void, E, Services>) =>
  Effect.forEach(
    Devices.drivers,
    (driver) =>
      Effect.gen(function* () {
        yield* Devices.space("nb-lena", "notebook", "owner");
        yield* body(driver).pipe(Effect.provide(engine));
      }).pipe(Effect.provide(Devices.database(driver)), Effect.scoped),
    { discard: true },
  );

const create = (id: string, title: string, notebook = "nb-lena") =>
  Effect.flatMap(SyncClient.Service, (sync) => sync.mutate(Notes.create, { notebook, id, title }));

const notes = Effect.flatMap(DeviceDatabase.make, (db) =>
  db.select().from(NotesDevice.Note).orderBy(NotesDevice.Note.id),
);

const overlay = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql<{ readonly id: string }>`select id from pending_row order by id`,
);

describe("SyncClient.mutate", () => {
  it.effect("a write shows in the views at once and waits in the outbox", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const { mutationId } = yield* create("n1", "Vokabeln");

        expect(mutationId, driver).toBe(1);
        expect(yield* notes, driver).toEqual([
          { space: "nb-lena", id: "n1", title: "Vokabeln", done: null },
        ]);
        expect(yield* Outbox.pending, driver).toEqual([
          {
            mutationId: 1,
            name: "note.create",
            version: 1,
            args: { notebook: "nb-lena", id: "n1", title: "Vokabeln" },
            at: 0,
            mode: "Seal",
          },
        ]);
        expect((yield* (yield* SyncClient.Service).status.get).waiting, driver).toBe(1);
      }),
    ),
  );

  it.effect("a failure between the overlay and the outbox leaves neither", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* sql`
          create trigger outbox_full before insert on outbox
          begin select raise(abort, 'disk full'); end
        `;

        const exit = yield* Effect.exit(create("n1", "Vokabeln"));

        expect(Exit.isFailure(exit), driver).toBe(true);
        expect(yield* overlay, driver).toEqual([]);
        expect(yield* Outbox.pending, driver).toEqual([]);
        expect((yield* Outbox.meta).lastMutationId, driver).toBe(0);
      }),
    ),
  );

  it.effect("the device refuses before queueing: an unknown space, a role, the mutator", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        yield* Devices.space("nb-shared", "notebook", "guest");

        const refusal = (
          effect: Effect.Effect<SyncClient.Mutation, { readonly _tag: string }, Services>,
        ) => Effect.match(effect, { onFailure: (error) => error._tag, onSuccess: () => "queued" });

        expect(yield* refusal(create("t1", "Mathe", "nb-tom")), driver).toBe("Sync.NotMember");
        expect(yield* refusal(create("g1", "Mathe", "nb-shared")), driver).toBe("Sync.NotAllowed");

        for (const id of ["n1", "n2", "n3"]) yield* create(id, "Mathe");

        expect(yield* refusal(create("n4", "Mathe")), driver).toBe("Notes.Full");
        expect(
          (yield* Outbox.pending).map((command) => command.mutationId),
          driver,
        ).toEqual([1, 2, 3]);
        expect(yield* overlay, driver).toEqual([{ id: "n1" }, { id: "n2" }, { id: "n3" }]);
      }),
    ),
  );

  it.effect("a write invalidates the tables it wrote, and a refused one nothing", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const reactivity = yield* Reactivity.Reactivity;
        const invalidated: Array<string> = [];

        for (const table of ["Note", "Choice"]) {
          reactivity.registerUnsafe([table], () => invalidated.push(table));
        }

        yield* create("n1", "Vokabeln");
        yield* Effect.flip(create("t1", "Mathe", "nb-tom"));

        expect(invalidated, driver).toEqual(["Note"]);
      }),
    ),
  );
});

describe("SyncClient restarts", () => {
  it.effect("a new engine on the same database keeps the client id and numbers on", () =>
    Effect.forEach(
      Devices.drivers,
      (driver) =>
        Effect.gen(function* () {
          yield* Devices.space("nb-lena", "notebook", "owner");

          const before = yield* Effect.scoped(
            Effect.provide(Effect.andThen(create("n1", "Mathe"), Outbox.meta), engine),
          );

          const { mutationId } = yield* Effect.scoped(
            Effect.provide(create("n2", "Deutsch"), engine),
          );

          expect(mutationId, driver).toBe(2);
          expect((yield* Outbox.meta).clientId, driver).toBe(before.clientId);
          expect(yield* notes, driver).toHaveLength(2);
        }).pipe(Effect.provide(Devices.database(driver)), Effect.scoped),
      { discard: true },
    ),
  );
});

const encodeReason = Schema.encodeEffect(Refusal.Engine);

describe("SyncClient refusals", () => {
  /** A refused command as a settled pull leaves it in `rejected_command`. */
  const seedRefusal = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const refused = {
      clientId: "client-old",
      mutationId: 7,
      name: "note.create",
      version: 1,
      args: { notebook: "nb-lena", id: "n1", title: "Vokabeln" },
      at: 0,
      reason: yield* encodeReason(new Refusal.NotMember({ space: "nb-lena" })),
    };

    yield* sql`
      insert into rejected_command (client_id, mutation_id, name, version, args, at, reason)
      values ('client-old', 7, 'note.create', 1, '{"id":"n1","notebook":"nb-lena","title":"Vokabeln"}',
        0, '{"_tag":"Sync.NotMember","space":"nb-lena"}')
    `;

    return refused;
  });

  it.effect("a refusal is redone from its stored arguments, or dismissed", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const refused = yield* seedRefusal;

        expect(yield* SyncClient.refusals.run(), driver).toEqual([refused]);

        const { mutationId } = yield* sync.redo(refused);

        expect(mutationId, driver).toBe(1);
        expect((yield* Outbox.pending)[0]?.args, driver).toEqual(refused.args);
        expect(yield* SyncClient.refusals.run(), driver).toEqual([]);

        yield* sync.dismiss(yield* seedRefusal);

        expect(yield* SyncClient.refusals.run(), driver).toEqual([]);
        expect(yield* Outbox.pending, driver).toHaveLength(1);
      }),
    ),
  );
});
