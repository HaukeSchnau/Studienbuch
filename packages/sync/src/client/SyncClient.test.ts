import { describe, expect, it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as Scope from "effect/Scope";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { Bounds } from "../protocol/Bounds.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Link } from "../simulation/Link.ts";
import { Network } from "../simulation/Network.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";
import { Devices } from "./fixture/Devices.ts";
import { Notes } from "./fixture/Notes.ts";
import { NotesDevice } from "./fixture/NotesDevice.ts";
import { Outbox } from "./Outbox.ts";
import { Ports } from "./Ports.ts";
import { Supervisor } from "./Supervisor.ts";
import { SyncClient } from "./SyncClient.ts";
import { SyncQuery } from "./SyncQuery.ts";
import { WebSocketTransport } from "./WebSocketTransport.ts";

const engine = SyncClient.layer(Notes.schema).pipe(
  Layer.provideMerge(
    Layer.mergeAll(Devices.session, Devices.secrets, Devices.crypto, Devices.disconnected),
  ),
);

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

const mutationIds = Effect.map(Outbox.pending, (commands) =>
  commands.map((command) => command.mutationId),
);

/** The tag a command failed with before the outbox, or `queued`. */
const outcome = (effect: Effect.Effect<unknown, { readonly _tag: string }, Services>) =>
  Effect.match(effect, { onFailure: (error) => error._tag, onSuccess: () => "queued" });

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

  it.effect("a readable command waits as `Mutate`", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* Devices.space("igs", "school", "reader");
        yield* Devices.baseRow("igs", "Course", "ma", '{"name":"Mathe"}');
        yield* sync.mutate(Notes.choose, { notebook: "nb-lena", school: "igs", course: "ma" });

        expect(
          (yield* Outbox.pending).map((command) => command.mode),
          driver,
        ).toEqual(["Mutate"]);
      }),
    ),
  );

  it.effect("a failure between the overlay and the outbox leaves neither", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* sql`
          create trigger outbox_full before insert on sync_outbox
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

  it.effect("the device refuses before queueing: ids, spaces, roles and the mutator", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        yield* Devices.space("nb-shared", "notebook", "guest");

        expect(yield* outcome(create("t1", "Mathe", "")), driver).toBe("Sync.InvalidArgs");
        expect(yield* outcome(create("t1", "Mathe", "nb-tom")), driver).toBe("Sync.NotMember");
        expect(yield* outcome(create("g1", "Mathe", "nb-shared")), driver).toBe("Sync.NotAllowed");

        for (const id of ["n1", "n2", "n3"]) yield* create(id, "Mathe");

        expect(yield* outcome(create("n4", "Mathe")), driver).toBe("Notes.Full");
        expect(yield* mutationIds, driver).toEqual([1, 2, 3]);
        expect(yield* overlay, driver).toEqual([{ id: "n1" }, { id: "n2" }, { id: "n3" }]);
      }),
    ),
  );

  it.effect("a command past a bound gets the server's refusal and never enters the outbox", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* Devices.space("igs", "school", "reader");
        yield* Devices.baseRow("igs", "Course", "ma", '{"name":"Mathe"}');
        yield* sync.mutate(Notes.choose, { notebook: "nb-lena", school: "igs", course: "ma" });

        const comment = (text: string) =>
          sync.mutate(Notes.comment, { notebook: "nb-lena", course: "ma", comment: text });

        const ids = Array.from({ length: Bounds.maxSealedWrites + 1 }, (_, index) => `n${index}`);
        const invalidArgs = new Refusal.InvalidArgs({ mutator: "choice.comment", version: 1 });

        expect(yield* Effect.flip(comment("x".repeat(Bounds.maxArgsBytes))), driver).toEqual(
          invalidArgs,
        );
        expect(yield* Effect.flip(comment("\u0000")), driver).toEqual(invalidArgs);
        expect(
          yield* Effect.flip(sync.mutate(Notes.createMany, { notebook: "nb-lena", ids })),
          driver,
        ).toEqual(new Refusal.TooLarge({ space: "nb-lena", id: "n0" }));
        expect(
          yield* Effect.flip(
            sync.mutate(Notes.createMany, { notebook: "nb-lena", ids: ["n\u0000"] }),
          ),
          driver,
        ).toEqual(new Refusal.BadEnvelope({ space: "nb-lena", id: "?" }));
        expect(yield* mutationIds, driver).toEqual([1]);
        expect(yield* overlay, driver).toEqual([{ id: "ma" }]);

        yield* comment("Leistungskurs");
        yield* sync.mutate(Notes.createMany, { notebook: "nb-lena", ids: ids.slice(1) });

        expect(yield* mutationIds, driver).toEqual([1, 2, 3]);
      }),
    ),
  );

  it.effect("a readable command that reads a note, or a stranger's mutator, dies", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* create("n1", "Mathe");

        const leak = yield* Effect.exit(
          sync.mutate(Notes.chooseByNote, { notebook: "nb-lena", id: "n1" }),
        );

        const stranger = yield* Effect.exit(
          sync.mutate({ ...Notes.create }, { notebook: "nb-lena", id: "n2", title: "Deutsch" }),
        );

        expect(Exit.hasDies(leak), driver).toBe(true);
        expect(Exit.hasDies(stranger), driver).toBe(true);
        expect(yield* mutationIds, driver).toEqual([1]);
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

const NoteRow = Schema.Struct({
  space: Schema.String,
  id: Schema.String,
  title: Schema.String,
  done: Schema.NullOr(Schema.Boolean),
});

const notesIn = SyncQuery.make({
  tables: [Notes.Note],
  query: (db, notebook: string) =>
    db.select().from(NotesDevice.Note).where(eq(NotesDevice.Note.space, notebook)),
  result: NoteRow,
});

describe("SyncQuery.family", () => {
  it.effect("an atom over a table shows a write to it", () =>
    Effect.forEach(
      Devices.drivers,
      (driver) =>
        Effect.gen(function* () {
          const registry = AtomRegistry.make();
          yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

          const runtime = Atom.runtime(
            Layer.effectDiscard(Devices.space("nb-lena", "notebook", "owner")).pipe(
              Layer.provideMerge(engine),
              Layer.provideMerge(Devices.database(driver)),
            ),
          );

          const atom = SyncQuery.family(runtime, notesIn)("nb-lena");

          const write = runtime.fn((title: string) =>
            Effect.flatMap(SyncClient.Service, (sync) =>
              sync.mutate(Notes.create, { notebook: "nb-lena", id: "n1", title }),
            ),
          );

          registry.mount(atom);
          expect(yield* AtomRegistry.getResult(registry, atom), driver).toEqual([]);
          registry.set(write, "Vokabeln");

          const shown = yield* AtomRegistry.toStream(registry, atom).pipe(
            Stream.filter(AsyncResult.isSuccess),
            Stream.map((result) => result.value),
            Stream.filter((rows) => rows.length > 0),
            Stream.runHead,
          );

          expect(shown, driver).toEqual(
            Option.some([{ space: "nb-lena", id: "n1", title: "Vokabeln", done: null }]),
          );
        }).pipe(Effect.scoped),
      { discard: true },
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
  /** A refused command as a settled pull leaves it, here for a notebook the device may not know. */
  const seedRefusal = (notebook: string) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const args = `{"id":"n1","notebook":"${notebook}","title":"Vokabeln"}`;

      yield* sql`
        insert into sync_rejected_command (client_id, mutation_id, name, version, args, at, reason)
        values ('client-old', 7, 'note.create', 1, ${args}, 0,
          '{"_tag":"Sync.NotMember","space":"nb-lena"}')
      `;

      return {
        clientId: "client-old",
        mutationId: 7,
        name: "note.create",
        version: 1,
        args: { id: "n1", notebook, title: "Vokabeln" },
        at: 0,
        reason: yield* encodeReason(new Refusal.NotMember({ space: "nb-lena" })),
      } satisfies Outbox.Rejected;
    });

  it.effect("a refusal is redone once from its stored arguments, or dismissed", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const refused = yield* seedRefusal("nb-lena");

        expect(yield* SyncClient.refusals.run(), driver).toEqual([refused]);

        const [first, second] = yield* Effect.all([sync.redo(refused), sync.redo(refused)]);

        expect(
          Option.map(first, (mutation) => mutation.mutationId),
          driver,
        ).toEqual(Option.some(1));
        expect(second, driver).toEqual(Option.none());
        expect(yield* Outbox.pending, driver).toHaveLength(1);
        expect((yield* Outbox.pending)[0]?.args, driver).toEqual(refused.args);
        expect(yield* SyncClient.refusals.run(), driver).toEqual([]);

        yield* sync.dismiss(yield* seedRefusal("nb-lena"));

        expect(yield* SyncClient.refusals.run(), driver).toEqual([]);
        expect(yield* Outbox.pending, driver).toHaveLength(1);
      }),
    ),
  );

  it.effect("a redo the device refuses keeps the refusal", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const refused = yield* seedRefusal("nb-tom");

        expect(yield* outcome(sync.redo(refused)), driver).toBe("Sync.NotMember");
        expect(yield* SyncClient.refusals.run(), driver).toEqual([refused]);
        expect(yield* Outbox.pending, driver).toEqual([]);
      }),
    ),
  );
});

describe("SyncClient online", () => {
  const ChooseArgs = Schema.Struct({ course: Schema.String });
  const decodeChoose = Schema.decodeUnknownEffect(ChooseArgs);

  /** A server that applies every push and returns the applied choices and the school's courses. */
  const server = Effect.gen(function* () {
    const pushed: Array<number> = [];
    const choices = new Map<number, string>();
    const pulled = yield* Queue.unbounded<void>();

    const handlers = Protocol.Rpcs.toLayer({
      "Sync.push": (request) =>
        Effect.gen(function* () {
          for (const command of request.commands) {
            pushed.push(command.mutationId);

            if (command._tag === "Mutate") {
              choices.set(
                command.mutationId,
                (yield* Effect.orDie(decodeChoose(command.args))).course,
              );
            }
          }

          return {
            lastMutationId: Math.max(0, ...choices.keys()),
            outcomes: request.commands.map((command) =>
              Protocol.Applied.make({ mutationId: command.mutationId }),
            ),
          };
        }),
      "Sync.pull": () =>
        Effect.gen(function* () {
          yield* Queue.offer(pulled, undefined);

          return {
            syncEpoch: "epoch-1",
            spaces: [
              {
                id: "nb-lena",
                kind: "notebook",
                role: "owner",
                version: choices.size,
                keyEpoch: null,
              },
              { id: "igs", kind: "school", role: "reader", version: 1, keyEpoch: null },
            ],
            patches: [
              {
                space: "igs",
                reset: true,
                to: 1,
                ops: [
                  {
                    tbl: "Course",
                    id: "ma",
                    version: 1,
                    row: Protocol.Readable.make({ data: { name: "Mathe" } }),
                  },
                ],
              },
              {
                space: "nb-lena",
                reset: true,
                to: choices.size,
                ops: [...choices.values()].map((course) => ({
                  tbl: "Choice",
                  id: course,
                  version: choices.size,
                  row: Protocol.Readable.make({ data: { course } }),
                })),
              },
            ],
            removed: [],
            lastMutationId: Math.max(0, ...choices.keys()),
            refusals: [],
            more: false,
          };
        }),
      "Sync.events": () => Stream.never,
    });

    const transport = Ports.Transport.of({
      connect: Effect.gen(function* () {
        const link = yield* Link.make(() => Effect.void);
        yield* Network.serveSocket(Protocol.Rpcs, link.server).pipe(
          Effect.provide(handlers),
          Effect.forkScoped,
        );

        return yield* WebSocketTransport.fromSocket(link.device);
      }),
    });

    return { pushed, pulled, transport };
  });

  it.effect("a write leaves for the server by itself and settles", () =>
    Effect.forEach(
      Devices.drivers,
      (driver) =>
        Effect.gen(function* () {
          const { pushed, pulled, transport } = yield* server;

          const online = SyncClient.layer(Notes.schema).pipe(
            Layer.provideMerge(
              Layer.mergeAll(
                Devices.session,
                Devices.secrets,
                Devices.crypto,
                Layer.succeed(Ports.Lifecycle, {
                  changes: Stream.make({ foreground: true, online: true }),
                }),
                Layer.succeed(Ports.Transport, transport),
              ),
            ),
            Layer.provideMerge(Devices.database(driver)),
          );

          yield* Effect.gen(function* () {
            const sync = yield* SyncClient.Service;

            const idle = sync.status.changes.pipe(
              Stream.filter((status) => !status.pulling && !status.pushing),
              Stream.runHead,
            );

            // The first round after connecting pulls the spaces and the school.
            yield* TestClock.adjust(Supervisor.debounce);
            yield* Queue.take(pulled);
            yield* idle;

            const { confirmed } = yield* sync.mutate(Notes.choose, {
              notebook: "nb-lena",
              school: "igs",
              course: "ma",
            });

            yield* TestClock.adjust(Supervisor.debounce);
            yield* confirmed;

            expect(pushed, driver).toEqual([1]);
            expect(yield* Outbox.pending, driver).toEqual([]);
            expect(yield* overlay, driver).toEqual([]);
            expect((yield* sync.status.get).connection, driver).toBe("online");
          }).pipe(Effect.provide(online));
        }).pipe(Effect.scoped),
      { discard: true },
    ),
  );
});
