import { describe, expect, it } from "@effect/vitest";
import { AccountKey, SealedRow, SpaceKey, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Command } from "../protocol/Command.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";
import { Devices } from "./fixture/Devices.ts";
import { Notes } from "./fixture/Notes.ts";
import { NotesDevice } from "./fixture/NotesDevice.ts";
import { Scripted } from "./fixture/Scripted.ts";
import { Keyring } from "./Keyring.ts";
import { Outbox } from "./Outbox.ts";
import { Replication } from "./Replication.ts";
import { Ports } from "./Ports.ts";
import { SyncClient } from "./SyncClient.ts";

/** The engine of one of Lena's devices, with its randomness and the account's root key or not. */
const engine = (seed: string, holdsKey = true, options?: SyncClient.Options) =>
  SyncClient.layer(Notes.schema, options).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Devices.session,
        holdsKey ? Devices.unlocked : Devices.secrets,
        TestCrypto.layer(seed),
        Devices.disconnected,
      ),
    ),
  );

/** One of Lena's devices: the engine on its own database. */
const device = (driver: Devices.Driver, seed: string, holdsKey = true) =>
  engine(seed, holdsKey).pipe(Layer.provideMerge(Devices.database(driver)));

const bytes = (fill: number) => new Uint8Array(32).fill(fill);

const onEachDriver = <E>(body: (driver: Devices.Driver) => Effect.Effect<void, E>) =>
  Effect.forEach(Devices.drivers, body, { discard: true });

/** Lena's notebook as the server lists it. */
const notebook = (version: number, keyEpoch: number | null) => [
  { id: "nb-lena", kind: "notebook", role: "owner", version, keyEpoch },
];

const notes = Effect.flatMap(DeviceDatabase.make, (db) =>
  db.select().from(NotesDevice.Note).orderBy(NotesDevice.Note.id),
);

const replicate = (remote: Parameters<SyncClient.Interface["replicate"]>[0]) =>
  Effect.flatMap(SyncClient.Service, (sync) => sync.replicate(remote));

const create = (id: string, title: string) =>
  Effect.flatMap(SyncClient.Service, (sync) =>
    sync.mutate(Notes.create, { notebook: "nb-lena", id, title }),
  );

const rename = (id: string, title: string) =>
  Effect.flatMap(SyncClient.Service, (sync) =>
    sync.mutate(Notes.rename, { notebook: "nb-lena", id, title }),
  );

const encodeBox = Schema.encodeEffect(Schema.toCodecJson(SpaceKey.KeyBox));
const encodeEnvelope = Schema.encodeEffect(Schema.toCodecJson(SealedRow.Envelope));
const encodePush = Schema.encodeEffect(Schema.fromJsonString(Protocol.PushRequest));
const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Json));

const sealOf = (request: Protocol.PushRequest | undefined) => {
  const command = request?.commands[0];

  return command?._tag === "Seal" ? Option.some(command) : Option.none();
};

/** What the server stores for a `Seal` and sends in a pull: its boxes, then its rows. */
const opsOf = Effect.fnUntraced(function* (seal: Command.Seal, version: number) {
  const ops: Array<Protocol.Op> = [];

  for (const box of seal.boxes) {
    ops.push({
      tbl: Protocol.keyBoxTable,
      id: Protocol.keyBoxId(box),
      version,
      row: Protocol.Readable.make({ data: yield* encodeBox(box) }),
    });
  }

  for (const write of seal.writes) {
    ops.push({
      tbl: "",
      id: write.id,
      version,
      row:
        write.ct === null
          ? Protocol.Deleted.make({})
          : Protocol.Sealed.make({ envelope: yield* encodeEnvelope(write.envelope), ct: write.ct }),
    });
  }

  return ops;
});

/** A key box of another device, as a pull delivers it. */
const boxOp = Effect.fnUntraced(function* (box: SpaceKey.KeyBox, version: number) {
  return {
    tbl: Protocol.keyBoxTable,
    id: Protocol.keyBoxId(box),
    version,
    row: Protocol.Readable.make({ data: yield* encodeBox(box) }),
  } satisfies Protocol.Op;
});

/** A sealed row of another device, as a pull delivers it. */
const rowOp = Effect.fnUntraced(function* (id: string, sealed: SealedRow.Sealed, version: number) {
  return {
    tbl: "",
    id,
    version,
    row: Protocol.Sealed.make({ envelope: yield* encodeEnvelope(sealed.envelope), ct: sealed.ct }),
  } satisfies Protocol.Op;
});

/** The server answers the push's first command `Stale` and stops there, as it does. */
const staleFirst: Scripted.PushAnswer = (request) =>
  Effect.succeed({
    lastMutationId: (request.commands[0]?.mutationId ?? 1) - 1,
    outcomes: request.commands
      .slice(0, 1)
      .map((command) => Protocol.Stale.make({ mutationId: command.mutationId })),
  });

/** The server answers the push's first command `answer` and stops there. */
const stopFirst =
  (answer: (mutationId: number) => Protocol.Outcome): Scripted.PushAnswer =>
  (request) =>
    Effect.succeed({
      lastMutationId: (request.commands[0]?.mutationId ?? 1) - 1,
      outcomes: request.commands.slice(0, 1).map((command) => answer(command.mutationId)),
    });

/** Lena's generations 1 and 2, and device A's wrapper, which generation 2 sealed its key to. */
const renewedAccount = Effect.gen(function* () {
  const wrapper = { id: "w-a", kind: "device", place: "", credentialId: "" } as const;
  const keys1 = yield* AccountKey.derive(Redacted.make(bytes(1)), Devices.actor, 1);
  const record1 = yield* AccountKey.record(keys1, "first");
  const keys2 = yield* AccountKey.derive(Redacted.make(bytes(2)), Devices.actor, 2);
  const record2 = yield* AccountKey.record(keys2, { keys: keys1, record: record1 });
  const { statement } = yield* Wrapper.create(wrapper, Redacted.make(bytes(9)), keys1);
  const kept = yield* Wrapper.reendorse(statement, record1, keys2);
  const renewal = yield* Wrapper.seal(kept, keys2);

  return { keys2, record2, own: { seal: renewal, records: [record1, record2] } };
});

/** Device A at generation 1, with its wrapper's seed, and its own seal as `served` returns it. */
const behind = (driver: Devices.Driver, served: Effect.Effect<Option.Option<Keyring.OwnSeal>>) =>
  SyncClient.layer(Notes.schema, { ownSeal: served }).pipe(
    Layer.provideMerge(
      Layer.mergeAll(Devices.session, Devices.secrets, TestCrypto.layer("a"), Devices.disconnected),
    ),
    Layer.provideMerge(Devices.database(driver)),
  );

/** Holds generation 1's root key and the wrapper's seed, as device A does. */
const atGeneration1 = Effect.gen(function* () {
  yield* (yield* Ports.DeviceSecrets).set("device-seed", bytes(9));
  yield* (yield* SyncClient.Service).unlock(bytes(1), 1);
});

const boxGenerations = (requests: ReadonlyArray<Protocol.PushRequest>) =>
  requests.map((request) =>
    Option.map(sealOf(request), (seal) => seal.boxes.map((box) => box.authorGeneration)),
  );

const encodeCommands = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(Command.Any)));

/** Opens the sealed row that `commands` carry for `id`, with `key`. */
const openPushed = (
  commands: ReadonlyArray<Command.Any>,
  id: string,
  key: Redacted.Redacted<Uint8Array>,
) =>
  Effect.gen(function* () {
    const write = commands
      .flatMap((command) => (command._tag === "Seal" ? command.writes : []))
      .find((each) => each.id === id);

    if (write === undefined || write.ct === null) return Option.none<string>();

    return yield* SealedRow.open({ space: write.space, id }, write.envelope, write.ct, key).pipe(
      Effect.map((opened) => Option.some(opened.json)),
      Effect.orElseSucceed(() => Option.none<string>()),
    );
  });

/** Lena writes `n1` on a device, which pushes it and pulls the server's copy back. */
const established = Effect.gen(function* () {
  yield* Devices.space("nb-lena", "notebook", "owner");
  yield* create("n1", "Geheimnis 4711");

  const echo: Scripted.PullAnswer = () =>
    Effect.gen(function* () {
      const seal = sealOf(server.pushes[0]);

      if (Option.isNone(seal)) return yield* Effect.die("No seal was pushed");

      return {
        syncEpoch: "epoch-1",
        spaces: notebook(1, 0),
        patches: [
          { space: "nb-lena", reset: true, to: 1, ops: yield* Effect.orDie(opsOf(seal.value, 1)) },
        ],
        removed: [],
        lastMutationId: 1,
        refusals: [],
        more: false,
      };
    });

  const server = Scripted.scripted({ push: [Scripted.applyAll], pull: [echo] });

  yield* replicate(server.remote);
  const seal = sealOf(server.pushes[0]);

  if (Option.isNone(seal)) return yield* Effect.die("No seal was pushed");

  return { seal: seal.value, ops: yield* opsOf(seal.value, 1), push: server.pushes[0] };
});

describe("Seal", () => {
  it.effect("a sealed write leaves as ciphertext and opens on another device of the account", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));
        const b = yield* Layer.build(device(driver, "b"));
        const { seal, ops, push } = yield* Effect.provide(established, a);

        // Epoch 0 opens with this write: its key travels in a box to Lena's own account.
        expect(seal.boxes, driver).toHaveLength(1);
        expect(
          seal.writes.map((write) => write.envelope.keyEpoch),
          driver,
        ).toEqual([0]);
        expect(seal.writes[0]?.base, driver).toEqual(Command.Absent.make({}));

        if (push === undefined) return yield* Effect.die("No push");
        expect(yield* encodePush(push), driver).not.toContain("Geheimnis 4711");

        yield* Effect.provide(
          replicate(
            Scripted.scripted({
              pull: [
                Scripted.page({
                  spaces: notebook(1, 0),
                  patches: [{ space: "nb-lena", reset: true, to: 1, ops }],
                }),
              ],
            }).remote,
          ),
          b,
        );

        expect(yield* Effect.provide(notes, b), driver).toEqual([
          { space: "nb-lena", id: "n1", title: "Geheimnis 4711", done: null },
        ]);
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a row whose key is missing waits and appears when the box arrives", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));
        const b = yield* Layer.build(device(driver, "b"));
        const { ops } = yield* Effect.provide(established, a);
        const [box, row] = ops;

        if (box === undefined || row === undefined) return yield* Effect.die("No ops");

        const pull = (patchOps: ReadonlyArray<Protocol.Op>, to: number, reset: boolean) =>
          Effect.provide(
            replicate(
              Scripted.scripted({
                pull: [
                  Scripted.page({
                    spaces: notebook(to, 0),
                    patches: [{ space: "nb-lena", reset, to, ops: patchOps }],
                  }),
                ],
              }).remote,
            ),
            b,
          );

        yield* pull([row], 1, true);
        expect(yield* Effect.provide(notes, b), driver).toEqual([]);

        yield* pull([{ ...box, version: 2 }], 2, false);
        expect(
          (yield* Effect.provide(notes, b)).map((note) => note.title),
          driver,
        ).toEqual(["Geheimnis 4711"]);
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a row of a format this build doesn't know waits as ciphertext", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));
        const b = yield* Layer.build(device(driver, "b"));
        const { ops } = yield* Effect.provide(established, a);
        const [box, row] = ops;

        if (box === undefined || row?.row._tag !== "Sealed") return yield* Effect.die("No ops");

        const newer = {
          ...row,
          row: Protocol.Sealed.make({
            envelope: { ...Object(row.row.envelope), format: 2 },
            ct: row.row.ct,
          }),
        };

        yield* Effect.provide(
          replicate(
            Scripted.scripted({
              pull: [
                Scripted.page({
                  spaces: notebook(1, 0),
                  patches: [{ space: "nb-lena", reset: true, to: 1, ops: [box, newer] }],
                }),
              ],
            }).remote,
          ),
          b,
        );

        expect(yield* Effect.provide(notes, b), driver).toEqual([]);

        const parked = yield* Effect.provide(
          Effect.flatMap(
            SqlClient.SqlClient,
            (sql) => sql<{ readonly id: string }>`select id from sync_sealed_row where tbl is null`,
          ),
          b,
        );

        expect(parked, driver).toEqual([{ id: "n1" }]);
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a `Stale` answer seals the command again on the newer row", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* established;
            yield* rename("n1", "Mathe neu");
            const key = yield* Keyring.spaceKey("nb-lena", 0);

            if (Option.isNone(key)) return yield* Effect.die("No space key");

            // Lena's other device renamed n1 first, and the server holds it at version 2.
            const other = yield* SealedRow.seal(
              { space: "nb-lena", id: "n1", table: "Note", json: '{"title":"Deutsch"}' },
              Devices.actor,
              0,
              key.value,
            );

            const stale: Scripted.PushAnswer = (request) =>
              Effect.succeed({
                lastMutationId: 1,
                outcomes: request.commands.map((command) =>
                  Protocol.Stale.make({ mutationId: command.mutationId }),
                ),
              });

            const server = Scripted.scripted({
              push: [stale, Scripted.applyAll],
              pull: [
                Scripted.page({
                  spaces: notebook(2, 0),
                  patches: [
                    {
                      space: "nb-lena",
                      reset: false,
                      to: 2,
                      ops: [
                        {
                          tbl: "",
                          id: "n1",
                          version: 2,
                          row: Protocol.Sealed.make({
                            envelope: yield* encodeEnvelope(other.envelope),
                            ct: other.ct,
                          }),
                        },
                      ],
                    },
                  ],
                  lastMutationId: 1,
                }),
                Scripted.page({ spaces: notebook(2, 0), lastMutationId: 2 }),
              ],
            });

            expect(yield* replicate(server.remote), driver).toBe("idle");

            const bases = server.pushes.map((request) =>
              Option.map(sealOf(request), (seal) => seal.writes[0]?.base),
            );

            expect(bases, driver).toEqual([
              Option.some(Command.AtVersion.make({ version: 1 })),
              Option.some(Command.AtVersion.make({ version: 2 })),
            ]);
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a sealed command that fails on newer rows goes out without them, refused", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* established;
            yield* rename("n1", "Mathe neu");

            // Lena's other device deleted n1, so the rename has no row to change. The server
            // didn't take the rename the first time, as the pull's last mutation id shows.
            const server = Scripted.scripted({
              push: [Scripted.retryFirst, Scripted.applyAll],
              pull: [
                Scripted.page({
                  spaces: notebook(2, 0),
                  patches: [
                    {
                      space: "nb-lena",
                      reset: false,
                      to: 2,
                      ops: [{ tbl: "", id: "n1", version: 2, row: Protocol.Deleted.make({}) }],
                    },
                  ],
                  lastMutationId: 1,
                }),
                Scripted.page({ spaces: notebook(2, 0), lastMutationId: 2 }),
              ],
            });

            yield* replicate(server.remote);
            yield* replicate(server.remote);

            expect(
              server.pushes.map((request) =>
                Option.map(sealOf(request), (seal) => seal.writes.length),
              ),
              driver,
            ).toEqual([Option.some(1), Option.some(0)]);
            expect(yield* notes, driver).toEqual([]);
            expect(
              (yield* Outbox.rejected).map((each) => each.reason._tag),
              driver,
            ).toEqual(["Tx.RowMissing"]);
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a row too large for the server never enters the outbox", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        const refusal = yield* Effect.provide(
          Effect.gen(function* () {
            yield* Devices.space("nb-lena", "notebook", "owner");

            return yield* Effect.match(create("n1", "x".repeat(70_000)), {
              onFailure: (error) => error._tag,
              onSuccess: () => "queued",
            });
          }),
          a,
        );

        expect(refusal, driver).toBe("Sync.TooLarge");
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("unlocking opens what waited, and lets sealed commands go", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));
        const c = yield* Layer.build(device(driver, "c", false));
        const { ops } = yield* Effect.provide(established, a);

        yield* Effect.provide(
          Effect.gen(function* () {
            const sync = yield* SyncClient.Service;

            yield* replicate(
              Scripted.scripted({
                pull: [
                  Scripted.page({
                    spaces: notebook(1, 0),
                    patches: [{ space: "nb-lena", reset: true, to: 1, ops }],
                  }),
                ],
              }).remote,
            );

            expect(yield* notes, driver).toEqual([]);
            yield* create("n2", "Bio");

            const locked = Scripted.scripted({ pull: [Scripted.page({ spaces: notebook(1, 0) })] });
            expect(yield* replicate(locked.remote), driver).toBe("retry");
            expect(locked.pushes, driver).toEqual([]);

            yield* sync.unlock(Devices.rootKey, 0);
            expect(
              (yield* notes).map((note) => note.id),
              driver,
            ).toEqual(["n1", "n2"]);

            const open = Scripted.scripted({
              push: [Scripted.applyAll],
              pull: [Scripted.page({ spaces: notebook(2, 0), lastMutationId: 1 })],
            });

            yield* replicate(open.remote);
            expect(Option.isSome(sealOf(open.pushes[0])), driver).toBe(true);
          }),
          c,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect(
    "a device behind the account's generation fetches its own seal, and the box opens",
    () =>
      onEachDriver((driver) =>
        Effect.gen(function* () {
          const wrapper = { id: "w-a", kind: "device", place: "", credentialId: "" } as const;

          // Lena's generations 1 and 2, and device A's wrapper, endorsed again by generation 2.
          const keys1 = yield* AccountKey.derive(Redacted.make(bytes(1)), Devices.actor, 1);
          const record1 = yield* AccountKey.record(keys1, "first");
          const keys2 = yield* AccountKey.derive(Redacted.make(bytes(2)), Devices.actor, 2);
          const record2 = yield* AccountKey.record(keys2, { keys: keys1, record: record1 });
          const { statement } = yield* Wrapper.create(wrapper, Redacted.make(bytes(9)), keys1);
          const kept = yield* Wrapper.reendorse(statement, record1, keys2);
          const renewal = yield* Wrapper.seal(kept, keys2);

          // Device B renewed to generation 2 and opened epoch 1 with a box and a row.
          const epochKey = yield* SpaceKey.generate;
          const box = yield* SpaceKey.box("nb-lena", [{ epoch: 1, key: epochKey }], record2, keys2);

          const row = yield* SealedRow.seal(
            { space: "nb-lena", id: "n1", table: "Note", json: '{"title":"Erneuert"}' },
            Devices.actor,
            1,
            epochKey,
          );

          const ops = [yield* boxOp(box, 1), yield* rowOp("n1", row, 1)];

          let served = Option.none<Keyring.OwnSeal>();

          const a = yield* Layer.build(
            SyncClient.layer(Notes.schema, { ownSeal: Effect.sync(() => served) }).pipe(
              Layer.provideMerge(
                Layer.mergeAll(
                  Devices.session,
                  Devices.secrets,
                  TestCrypto.layer("a"),
                  Devices.disconnected,
                ),
              ),
              Layer.provideMerge(Devices.database(driver)),
            ),
          );

          yield* Effect.provide(
            Effect.gen(function* () {
              const sql = yield* SqlClient.SqlClient;
              yield* (yield* Ports.DeviceSecrets).set("device-seed", bytes(9));
              yield* (yield* SyncClient.Service).unlock(bytes(1), 1);

              yield* replicate(
                Scripted.scripted({
                  pull: [
                    Scripted.page({
                      spaces: notebook(1, 1),
                      patches: [{ space: "nb-lena", reset: true, to: 1, ops }],
                    }),
                  ],
                }).remote,
              );

              // A refuses the box of a generation it doesn't hold, keeps it, and the row waits.
              expect(yield* notes, driver).toEqual([]);
              expect(
                yield* sql`select id from base_row where tbl = ${Protocol.keyBoxTable}`,
                driver,
              ).toHaveLength(1);

              served = Option.some({ seal: renewal, records: [record1, record2] });

              yield* replicate(
                Scripted.scripted({ pull: [Scripted.page({ spaces: notebook(1, 1) })] }).remote,
              );

              expect(yield* notes, driver).toEqual([
                { space: "nb-lena", id: "n1", title: "Erneuert", done: null },
              ]);
            }),
            a,
          );
        }).pipe(Effect.provide(TestCrypto.layer("renewal")), Effect.scoped),
      ),
  );

  it.effect("a device's own epoch-0 key seals nothing once the server lists another epoch 0", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const b = yield* Layer.build(device(driver, "b"));

        // Device A, at generation 1, opened epoch 0 first. B holds generation 0.
        const keys1 = yield* AccountKey.derive(Redacted.make(bytes(1)), Devices.actor, 1);
        const record1 = yield* AccountKey.record(keys1, "first");
        const epochKey = yield* SpaceKey.generate;
        const box = yield* SpaceKey.box("nb-lena", [{ epoch: 0, key: epochKey }], record1, keys1);

        const row = yield* SealedRow.seal(
          { space: "nb-lena", id: "from-a", table: "Note", json: '{"title":"A"}' },
          Devices.actor,
          0,
          epochKey,
        );

        const ops = [yield* boxOp(box, 1), yield* rowOp("from-a", row, 1)];

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* Devices.space("nb-lena", "notebook", "owner");
            yield* create("from-b", "B");

            const server = Scripted.scripted({
              push: [staleFirst, Scripted.applyAll],
              pull: [
                Scripted.page({
                  spaces: notebook(1, 0),
                  patches: [{ space: "nb-lena", reset: true, to: 1, ops }],
                  lastMutationId: 0,
                }),
                Scripted.page({ spaces: notebook(1, 0) }),
              ],
            });

            yield* replicate(server.remote);

            // B can't open A's box, so `from-b` waits instead of leaving under B's own key.
            expect(server.pushes, driver).toHaveLength(1);
          }),
          b,
        );
      }).pipe(Effect.provide(TestCrypto.layer("race")), Effect.scoped),
    ),
  );

  it.effect(
    "a write over a row this build can't open is refused instead of claiming its version",
    () =>
      onEachDriver((driver) =>
        Effect.gen(function* () {
          const a = yield* Layer.build(device(driver, "a"));
          const b = yield* Layer.build(device(driver, "b"));
          const { ops } = yield* Effect.provide(established, a);
          const [box, row] = ops;

          if (box === undefined || row?.row._tag !== "Sealed") return yield* Effect.die("No ops");

          // n1 and n2 in a format newer than this build.
          const sealed = row.row;

          const newer = (id: string) => ({
            ...row,
            id,
            row: Protocol.Sealed.make({
              envelope: { ...Object(sealed.envelope), format: 2 },
              ct: sealed.ct,
            }),
          });

          yield* Effect.provide(
            Effect.gen(function* () {
              yield* Devices.space("nb-lena", "notebook", "owner");
              yield* create("n2", "Vorher");

              // The server holds n2 already, so it answers the create `Stale`.
              const server = Scripted.scripted({
                push: [staleFirst, Scripted.retryFirst],
                pull: [
                  Scripted.page({
                    spaces: notebook(1, 0),
                    patches: [
                      {
                        space: "nb-lena",
                        reset: true,
                        to: 1,
                        ops: [box, newer("n1"), newer("n2")],
                      },
                    ],
                    lastMutationId: 0,
                  }),
                  Scripted.page({ spaces: notebook(1, 0) }),
                ],
              });

              yield* replicate(server.remote);

              const refusal = yield* Effect.match(create("n1", "Neu"), {
                onFailure: (error) => error._tag,
                onSuccess: () => "queued",
              });

              expect(refusal, driver).toBe("SyncClient.Unreadable");
              expect(
                (yield* Outbox.pending).map((command) => command.failure?._tag),
                driver,
              ).toEqual(["SyncClient.Unreadable"]);
              expect(
                Option.map(sealOf(server.pushes[1]), (seal) => seal.writes),
                driver,
              ).toEqual(Option.some([]));
            }),
            b,
          );
        }).pipe(Effect.scoped),
      ),
  );

  it.effect("a sealed command whose answer was lost goes out again byte for byte", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* Devices.space("nb-lena", "notebook", "owner");
            yield* create("n1", "Mathe");

            const lost: Scripted.PushAnswer = () => Effect.fail(new Replication.Disconnected());

            const server = Scripted.scripted({
              push: [lost, Scripted.applyAll],
              pull: [Scripted.page({ spaces: notebook(1, 0), lastMutationId: 1 })],
            });

            yield* Effect.exit(replicate(server.remote));
            yield* replicate(server.remote);

            const [first, again] = server.pushes;

            if (first === undefined || again === undefined) return yield* Effect.die("No resend");
            expect(yield* encodePush(again), driver).toBe(yield* encodePush(first));
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a resent command keeps the outcome it went out with, and settles as applied", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const lost: Scripted.PushAnswer = () => Effect.fail(new Replication.Disconnected());

        const server = Scripted.scripted({
          push: [lost, Scripted.applyAll],
          pull: [Scripted.page({ spaces: notebook(4, 0), lastMutationId: 2 })],
        });

        // Lena writes n2, and the answer to its push is lost.
        const others = yield* Effect.scoped(
          Effect.provide(
            Effect.gen(function* () {
              yield* established;
              yield* create("n2", "Bio");
              yield* Effect.exit(replicate(server.remote));
              const key = yield* Keyring.spaceKey("nb-lena", 0);

              if (Option.isNone(key)) return yield* Effect.die("No space key");

              return yield* Effect.forEach(["n3", "n4"], (id) =>
                SealedRow.seal(
                  { space: "nb-lena", id, table: "Note", json: '{"title":"Andere"}' },
                  Devices.actor,
                  0,
                  key.value,
                ),
              );
            }),
            engine("a"),
          ),
        );

        // Two notes of Lena's other device, which an older build parked.
        for (const [index, sealed] of others.entries()) {
          const envelope = yield* encodeJson(yield* encodeEnvelope(sealed.envelope));

          yield* sql`
            insert into sync_sealed_row (space, id, version, tbl, envelope, ct)
            values ('nb-lena', ${`n${index + 3}`}, ${index + 2}, null, ${envelope}, ${sealed.ct})
          `;
        }

        yield* sql`update sync_meta set opened_with = 'an older build'`;

        // The next start opens them, so n2 would now be one note too many. It went out before.
        yield* Effect.scoped(Effect.provide(replicate(server.remote), engine("a")));

        const [first, again] = server.pushes;

        if (first === undefined || again === undefined) return yield* Effect.die("No resend");
        expect(yield* encodePush(again), driver).toBe(yield* encodePush(first));
        expect(yield* Outbox.rejected, driver).toEqual([]);
      }).pipe(Effect.provide(Devices.database(driver))),
    ),
  );

  it.effect("a build that opens other formats opens the parked rows at start", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const { seal } = yield* Effect.scoped(Effect.provide(established, engine("a")));
        const [write] = seal.writes;

        if (write === undefined || write.ct === null) return yield* Effect.die("No write");
        const sql = yield* SqlClient.SqlClient;
        const envelope = yield* encodeJson(yield* encodeEnvelope(write.envelope));

        // An older build parked n1, which this one can open.
        yield* sql`delete from base_row where tbl = 'Note'`;
        yield* sql`
          update sync_sealed_row set tbl = null, envelope = ${envelope}, ct = ${write.ct}
          where id = 'n1'
        `;
        yield* sql`update sync_meta set opened_with = 'an older build'`;

        const opened = yield* Effect.scoped(Effect.provide(notes, engine("a")));

        expect(
          opened.map((note) => note.title),
          driver,
        ).toEqual(["Geheimnis 4711"]);
      }).pipe(Effect.provide(Devices.database(driver))),
    ),
  );

  it.effect("a sealed command queued before drafts existed gets them before its first push", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* Effect.scoped(
          Effect.provide(
            Effect.gen(function* () {
              yield* Devices.space("nb-lena", "notebook", "owner");
              yield* create("n1", "Mathe");
            }),
            engine("a"),
          ),
        );

        // The outbox as a build without drafts left it, on a device that pulled before.
        yield* sql`update sync_outbox set writes = null`;
        yield* sql`update sync_space set version = 1`;

        const server = Scripted.scripted({
          push: [Scripted.applyAll],
          pull: [Scripted.page({ spaces: notebook(1, 0), lastMutationId: 1 })],
        });

        yield* Effect.scoped(Effect.provide(replicate(server.remote), engine("a")));

        expect(
          Option.map(sealOf(server.pushes[0]), (each) => each.writes.map((write) => write.id)),
          driver,
        ).toEqual(Option.some(["n1"]));
      }).pipe(Effect.provide(Devices.database(driver))),
    ),
  );

  it.effect("notes behind a `Stale` seal again, under the key the server's epoch has", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const b = yield* Layer.build(device(driver, "b"));

        // Device A, at the same generation, opened epoch 0 first.
        const keys0 = yield* AccountKey.derive(Redacted.make(Devices.rootKey), Devices.actor, 0);
        const record0 = yield* AccountKey.record(keys0, "first");
        const epochKey = yield* SpaceKey.generate;
        const box = yield* SpaceKey.box("nb-lena", [{ epoch: 0, key: epochKey }], record0, keys0);

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* Devices.space("nb-lena", "notebook", "owner");
            yield* create("n1", "Erste");
            yield* create("n2", "Zweite");

            const server = Scripted.scripted({
              push: [staleFirst, Scripted.applyAll],
              pull: [
                Scripted.page({
                  spaces: notebook(1, 0),
                  patches: [{ space: "nb-lena", reset: true, to: 1, ops: [yield* boxOp(box, 1)] }],
                  lastMutationId: 0,
                }),
                Scripted.page({ spaces: notebook(3, 0), lastMutationId: 2 }),
              ],
            });

            yield* replicate(server.remote);

            expect(
              Option.isSome(yield* openPushed(server.pushes[1]?.commands ?? [], "n2", epochKey)),
              driver,
            ).toBe(true);
          }),
          b,
        );
      }).pipe(Effect.provide(TestCrypto.layer("behind")), Effect.scoped),
    ),
  );

  it.effect("a rename behind a `Stale` seals again on the other device's newer row", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* established;
            yield* rename("n1", "X");
            yield* rename("n1", "Z");
            const key = yield* Keyring.spaceKey("nb-lena", 0);

            if (Option.isNone(key)) return yield* Effect.die("No space key");

            // Lena's other device marked n1 done, and the server holds that at version 2.
            const done = yield* SealedRow.seal(
              {
                space: "nb-lena",
                id: "n1",
                table: "Note",
                json: '{"done":true,"title":"Geheimnis 4711"}',
              },
              Devices.actor,
              0,
              key.value,
            );

            const server = Scripted.scripted({
              push: [staleFirst, Scripted.applyAll],
              pull: [
                Scripted.page({
                  spaces: notebook(2, 0),
                  patches: [
                    {
                      space: "nb-lena",
                      reset: false,
                      to: 2,
                      ops: [yield* rowOp("n1", done, 2)],
                    },
                  ],
                  lastMutationId: 1,
                }),
                Scripted.page({ spaces: notebook(4, 0), lastMutationId: 3 }),
              ],
            });

            yield* replicate(server.remote);

            const last = server.pushes[1]?.commands.at(-1);

            expect(last?.mutationId, driver).toBe(3);
            expect(
              yield* openPushed(last === undefined ? [] : [last], "n1", key.value),
              driver,
            ).toEqual(Option.some('{"done":true,"title":"Z"}'));
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("after a restore of the server, restored notes wait for its snapshot", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* established;

            // The server came back from a backup taken before n1, epoch 0 included.
            const server = Scripted.scripted({
              push: [Scripted.applyAll],
              pull: [
                () =>
                  Effect.fail(
                    new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 0 }),
                  ),
                Scripted.page({
                  syncEpoch: "epoch-2",
                  spaces: notebook(1, null),
                  patches: [{ space: "nb-lena", reset: true, to: 1, ops: [] }],
                  lastMutationId: 0,
                }),
                Scripted.page({ syncEpoch: "epoch-2", spaces: notebook(2, 0), lastMutationId: 1 }),
              ],
            });

            yield* replicate(server.remote);
            yield* replicate(server.remote);

            expect(
              server.pushes.map((request) =>
                Option.map(sealOf(request), (seal) => seal.writes.map((write) => write.id)),
              ),
              driver,
            ).toEqual([Option.some(["n1"])]);
            expect(yield* Outbox.rejected, driver).toEqual([]);
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect("a keychain that comes back opens the box a locked start couldn't", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const stored = new Map<Ports.SecretName, Uint8Array>([["root-key", Devices.rootKey]]);
        let locked = false;

        const secrets = Layer.succeed(
          Ports.DeviceSecrets,
          Ports.DeviceSecrets.of({
            get: (name) =>
              locked
                ? Effect.fail(new Ports.SecretsUnavailable({ secret: name }))
                : Effect.sync(() => Option.fromNullishOr(stored.get(name))),
            set: (name, value) => Effect.sync(() => void stored.set(name, value)),
            remove: (name) => Effect.sync(() => void stored.delete(name)),
          }),
        );

        const lockable = SyncClient.layer(Notes.schema).pipe(
          Layer.provideMerge(
            Layer.mergeAll(Devices.session, secrets, TestCrypto.layer("a"), Devices.disconnected),
          ),
        );

        // The device opens epoch 0 with n1, and the server takes it.
        const first = Scripted.scripted({
          push: [Scripted.applyAll],
          pull: [Scripted.page({ spaces: notebook(1, null), lastMutationId: 1 })],
        });

        yield* Effect.scoped(
          Effect.provide(
            Effect.gen(function* () {
              yield* Devices.space("nb-lena", "notebook", "owner");
              yield* create("n1", "Geheimnis 4711");
              yield* replicate(first.remote);
            }),
            lockable,
          ),
        );

        const seal = sealOf(first.pushes[0]);

        if (Option.isNone(seal)) return yield* Effect.die("No seal was pushed");
        const ops = yield* opsOf(seal.value, 1);

        // The next start finds the keychain locked when the server's copy arrives.
        locked = true;

        yield* Effect.scoped(
          Effect.provide(
            Effect.gen(function* () {
              yield* replicate(
                Scripted.scripted({
                  pull: [
                    Scripted.page({
                      spaces: notebook(1, 0),
                      patches: [{ space: "nb-lena", reset: true, to: 1, ops }],
                    }),
                  ],
                }).remote,
              );

              locked = false;
              yield* replicate(
                Scripted.scripted({ pull: [Scripted.page({ spaces: notebook(1, 0) })] }).remote,
              );

              expect(
                (yield* notes).map((note) => note.title),
                driver,
              ).toEqual(["Geheimnis 4711"]);
              expect(
                yield* (yield* SqlClient.SqlClient)<{ readonly made_here: number }>`
                  select made_here from sync_space_key
                `,
                driver,
              ).toEqual([{ made_here: 0 }]);
            }),
            lockable,
          ),
        );
      }).pipe(Effect.provide(Devices.database(driver))),
    ),
  );

  it.effect("a Seal the server has no key record for waits until the keys change", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        const a = yield* Layer.build(device(driver, "a"));

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* Devices.space("nb-lena", "notebook", "owner");
            yield* create("n1", "Mathe");

            const server = Scripted.scripted({
              push: [
                stopFirst((mutationId) => Protocol.NoKeyRecord.make({ mutationId })),
                Scripted.applyAll,
              ],
              pull: [
                Scripted.page({ spaces: notebook(0, null), lastMutationId: 0 }),
                Scripted.page({ spaces: notebook(0, null), lastMutationId: 0 }),
                Scripted.page({ spaces: notebook(1, 0), lastMutationId: 1 }),
              ],
            });

            yield* replicate(server.remote);
            yield* replicate(server.remote);
            expect(server.pushes, driver).toHaveLength(1);

            // The app published the account's record (`Keys.init`) and hands the engine its key.
            yield* (yield* SyncClient.Service).unlock(Devices.rootKey, 0);
            yield* replicate(server.remote);

            expect(
              Option.map(sealOf(server.pushes[1]), (seal) => seal.writes.map((write) => write.id)),
              driver,
            ).toEqual(Option.some(["n1"]));
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect(
    "`KeysBehind` fetches the device's own seal and seals again at the newer generation",
    () =>
      onEachDriver((driver) =>
        Effect.gen(function* () {
          const { own } = yield* renewedAccount;
          const a = yield* Layer.build(behind(driver, Effect.succeedSome(own)));

          yield* Effect.provide(
            Effect.gen(function* () {
              yield* atGeneration1;
              yield* Devices.space("nb-lena", "notebook", "owner");
              yield* create("n1", "Mathe");

              const server = Scripted.scripted({
                push: [
                  stopFirst((mutationId) =>
                    Protocol.KeysBehind.make({ mutationId, generation: 2 }),
                  ),
                  Scripted.applyAll,
                ],
                pull: [
                  Scripted.page({ spaces: notebook(0, null), lastMutationId: 0 }),
                  Scripted.page({ spaces: notebook(1, 0), lastMutationId: 1 }),
                ],
              });

              expect(yield* replicate(server.remote), driver).toBe("idle");
              expect(boxGenerations(server.pushes), driver).toEqual([
                Option.some([1]),
                Option.some([2]),
              ]);
            }),
            a,
          );
        }).pipe(Effect.provide(TestCrypto.layer("keys-behind")), Effect.scoped),
      ),
  );

  it.effect("`KeysBehind` at an older generation than the device's holds its Seals", () =>
    onEachDriver((driver) =>
      Effect.gen(function* () {
        let fetched = 0;

        const a = yield* Layer.build(
          behind(
            driver,
            Effect.sync(() => {
              fetched += 1;

              return Option.none<Keyring.OwnSeal>();
            }),
          ),
        );

        yield* Effect.provide(
          Effect.gen(function* () {
            yield* atGeneration1;
            yield* Devices.space("nb-lena", "notebook", "owner");
            yield* create("n1", "Mathe");

            // The server lost generation 1's record: a seal can't help, the records need publishing.
            const server = Scripted.scripted({
              push: [
                stopFirst((mutationId) => Protocol.KeysBehind.make({ mutationId, generation: 0 })),
              ],
              pull: [
                Scripted.page({ spaces: notebook(0, null), lastMutationId: 0 }),
                Scripted.page({ spaces: notebook(0, null), lastMutationId: 0 }),
              ],
            });

            yield* replicate(server.remote);
            yield* replicate(server.remote);

            expect(server.pushes, driver).toHaveLength(1);
            expect(fetched, driver).toBe(0);
          }),
          a,
        );
      }).pipe(Effect.scoped),
    ),
  );

  it.effect(
    "commands a dropped connection may have applied go out again unchanged, restore or not",
    () =>
      onEachDriver((driver) =>
        Effect.gen(function* () {
          const a = yield* Layer.build(device(driver, "a"));

          yield* Effect.provide(
            Effect.gen(function* () {
              yield* Devices.space("nb-lena", "notebook", "owner");
              yield* create("n1", "Mathe");
              yield* create("n2", "Deutsch");

              const lost: Scripted.PushAnswer = () => Effect.fail(new Replication.Disconnected());

              const restored: Scripted.PushAnswer = () =>
                Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 0 }));

              const server = Scripted.scripted({
                push: [lost, restored, Scripted.applyAll],
                pull: [
                  Scripted.page({
                    syncEpoch: "epoch-2",
                    spaces: notebook(1, 0),
                    lastMutationId: 2,
                  }),
                ],
              });

              yield* Effect.exit(replicate(server.remote));
              yield* replicate(server.remote);

              const sent = yield* Effect.forEach(server.pushes, (request) =>
                encodeCommands(request.commands),
              );

              expect(sent, driver).toHaveLength(3);
              expect(new Set(sent).size, driver).toBe(1);
            }),
            a,
          );
        }).pipe(Effect.scoped),
      ),
  );
});
