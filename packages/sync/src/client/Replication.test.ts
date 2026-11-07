import { describe, expect, it } from "@effect/vitest";
import { TestCrypto } from "@stu/e2ee/testing";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as Scope from "effect/Scope";
import * as TestClock from "effect/testing/TestClock";
import { Protocol } from "../protocol/Protocol.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";
import { Devices } from "./fixture/Devices.ts";
import { Scripted } from "./fixture/Scripted.ts";
import { Notes } from "./fixture/Notes.ts";
import { NotesDevice } from "./fixture/NotesDevice.ts";
import { Outbox } from "./Outbox.ts";
import { Ports } from "./Ports.ts";
import { Replication } from "./Replication.ts";
import { SyncClient } from "./SyncClient.ts";

const engine = SyncClient.layer(Notes.schema).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Devices.session,
      Devices.secrets,
      TestCrypto.layer("device"),
      Devices.disconnected,
    ),
  ),
);

type Services =
  | SyncClient.Service
  | Ports.DeviceSecrets
  | SqlClient.SqlClient
  | Reactivity.Reactivity
  | Scope.Scope;

const onEachDevice = <E>(body: (driver: Devices.Driver) => Effect.Effect<void, E, Services>) =>
  Effect.forEach(
    Devices.drivers,
    (driver) =>
      body(driver).pipe(
        Effect.provide(engine.pipe(Layer.provideMerge(Devices.database(driver)))),
        Effect.scoped,
      ),
    { discard: true },
  );

const enrolled = Effect.gen(function* () {
  const sync = yield* SyncClient.Service;

  expect(yield* sync.replicate(Scripted.scripted({ pull: [Scripted.school] }).remote)).toBe("idle");
});

const choose = (course: string) =>
  Effect.flatMap(SyncClient.Service, (sync) =>
    sync.mutate(Notes.choose, { notebook: "nb-lena", school: "igs", course }),
  );

const choices = Effect.flatMap(DeviceDatabase.make, (db) =>
  db.select().from(NotesDevice.Choice).orderBy(NotesDevice.Choice.id),
);

const rows = (table: "base_row" | "pending_row") =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly id: string }>`
      select id from ${sql(table)} where tbl = 'Choice' order by id
    `,
  );

const encodeReason = Schema.encodeEffect(Notes.NotOffered);

describe("SyncClient.replicate", () => {
  it.effect("after a pull the views show the server's rows plus a replay of the outbox", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        const ma = yield* choose("ma");
        yield* choose("de");

        const server = Scripted.scripted({
          push: [
            () =>
              Effect.succeed({
                lastMutationId: 1,
                outcomes: [
                  Protocol.Applied.make({ mutationId: 1 }),
                  Protocol.Retry.make({ mutationId: 2 }),
                ],
              }),
          ],
          pull: [
            Scripted.page({
              spaces: Scripted.listed(1),
              patches: [
                {
                  space: "nb-lena",
                  reset: true,
                  to: 1,
                  ops: [Scripted.readable("Choice", "ma", 1, { course: "ma" })],
                },
              ],
              lastMutationId: 1,
            }),
          ],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("retry");
        expect(Scripted.ids(server.pushes[0]), driver).toEqual([1, 2]);
        expect(server.pulls[0]?.cursors, driver).toEqual([{ space: "igs", version: 1 }]);
        expect(yield* choices, driver).toEqual([
          { space: "nb-lena", id: "de", course: "de", comment: null },
          { space: "nb-lena", id: "ma", course: "ma", comment: null },
        ]);
        expect(yield* rows("base_row"), driver).toEqual([{ id: "ma" }]);
        expect(yield* rows("pending_row"), driver).toEqual([{ id: "de" }]);
        expect(
          (yield* Outbox.pending).map((command) => command.mutationId),
          driver,
        ).toEqual([2]);
        expect(yield* ma.confirmed, driver).toBeUndefined();
        expect(yield* SyncClient.spaces.run(), driver).toEqual([
          {
            id: "igs",
            kind: "school",
            role: "reader",
            version: 1,
            syncedAt: DateTime.makeUnsafe(0),
          },
          {
            id: "nb-lena",
            kind: "notebook",
            role: "owner",
            version: 1,
            syncedAt: DateTime.makeUnsafe(0),
          },
        ]);
      }),
    ),
  );

  it.effect("a refusal takes the command's effect away and keeps its reason", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const reactivity = yield* Reactivity.Reactivity;
        yield* enrolled;
        const ma = yield* choose("ma");
        const reason = yield* encodeReason(new Notes.NotOffered({ course: "ma" }));
        const invalidated: Array<string> = [];

        for (const key of ["Choice", SyncClient.keys.refusals]) {
          reactivity.registerUnsafe([key], () => invalidated.push(key));
        }

        const server = Scripted.scripted({
          push: [
            () =>
              Effect.succeed({
                lastMutationId: 1,
                outcomes: [Protocol.Rejected.make({ mutationId: 1, reason })],
              }),
          ],
          // The patch has no Choice row: only the old overlay touched the table.
          pull: [Scripted.page({ lastMutationId: 1, refusals: [{ mutationId: 1, reason }] })],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("idle");
        expect(yield* choices, driver).toEqual([]);
        expect(yield* Outbox.pending, driver).toEqual([]);
        expect(
          (yield* Outbox.rejected).map((each) => each.reason),
          driver,
        ).toEqual([reason]);
        expect(invalidated, driver).toEqual(["Choice", SyncClient.keys.refusals]);

        const refusal = yield* Effect.match(ma.confirmed, {
          onFailure: (error) => error.reason,
          onSuccess: () => undefined,
        });

        expect(refusal, driver).toEqual(reason);
      }),
    ),
  );

  it.effect("after a lost push the device sends again from its first unsettled command", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;

        for (const course of ["ma", "de", "en"]) yield* choose(course);

        const server = Scripted.scripted({
          push: [
            () => Effect.fail(new Replication.Disconnected()),
            // The server applied 1 and 2 before the connection dropped: it reports them again.
            Scripted.applyAll,
          ],
          pull: [Scripted.page({ lastMutationId: 3 })],
        });

        const lost = yield* Effect.exit(sync.replicate(server.remote));

        expect(Exit.isFailure(lost), driver).toBe(true);
        expect(yield* sync.replicate(server.remote), driver).toBe("idle");
        expect(server.pushes.map(Scripted.ids), driver).toEqual([
          [1, 2, 3],
          [1, 2, 3],
        ]);
        expect(yield* Outbox.pending, driver).toEqual([]);
      }),
    ),
  );

  it.effect("a command whose replay fails loses its effect and keeps its place", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");
        yield* choose("de");

        const server = Scripted.scripted({
          push: [Scripted.retryFirst],
          // The Scripted.school stopped offering Mathe, so `choice.set` for it now refuses on the device.
          pull: [
            Scripted.page({
              patches: [
                { space: "igs", reset: false, to: 2, ops: [Scripted.deleted("Course", "ma", 2)] },
              ],
            }),
          ],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("retry");
        expect(yield* choices, driver).toEqual([
          { space: "nb-lena", id: "de", course: "de", comment: null },
        ]);
        expect(
          (yield* Outbox.pending).map((command) => command.mutationId),
          driver,
        ).toEqual([1, 2]);
      }),
    ),
  );

  it.effect("the server's restore brings settled commands back, or a new client id", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");
        yield* choose("de");
        yield* sync.replicate(
          Scripted.scripted({
            push: [Scripted.applyAll],
            pull: [Scripted.page({ lastMutationId: 2 })],
          }).remote,
        );
        yield* choose("en");

        // The restored database knows only command 1, so 2 comes back ahead of 3.
        const restored = Scripted.scripted({
          push: [
            () =>
              Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 1 })),
            Scripted.applyAll,
          ],
          // Every space comes back whole after a restore.
          pull: [
            Scripted.page({
              syncEpoch: "epoch-2",
              lastMutationId: 3,
              patches: [Scripted.schoolPatch],
            }),
          ],
        });

        expect(yield* sync.replicate(restored.remote), driver).toBe("idle");
        expect(restored.pushes.map(Scripted.ids), driver).toEqual([[3], [2, 3]]);
        expect(restored.pushes[1]?.syncEpoch, driver).toBe("epoch-2");
        expect(restored.pulls[0]?.cursors, driver).toEqual([]);

        // Eight days later the device holds no settled command older than a week.
        yield* TestClock.adjust("8 days");
        yield* choose("fr");
        yield* sync.replicate(
          Scripted.scripted({
            push: [Scripted.applyAll],
            pull: [Scripted.page({ lastMutationId: 4 })],
          }).remote,
        );
        const { clientId } = yield* Outbox.meta;
        const late = yield* choose("ku");

        const forgotten = Scripted.scripted({
          push: [
            () =>
              Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-3", lastMutationId: 2 })),
            Scripted.applyAll,
          ],
          pull: [Scripted.page({ syncEpoch: "epoch-3", lastMutationId: 2 })],
        });

        // Command 3 is gone, so 4 and 5 start over as 1 and 2 under a new client id.
        expect(yield* sync.replicate(forgotten.remote), driver).toBe("idle");
        expect(forgotten.pushes.map(Scripted.ids), driver).toEqual([[5], [1, 2]]);
        expect(forgotten.pushes[1]?.clientId, driver).not.toBe(clientId);
        expect(yield* late.confirmed, driver).toBeUndefined();
      }),
    ),
  );

  it.effect("a client the server forgot starts over under a new id", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");
        const { clientId } = yield* Outbox.meta;

        const server = Scripted.scripted({
          push: [() => Effect.fail(new Protocol.ClientUnknown()), Scripted.applyAll],
          pull: [Scripted.page({ lastMutationId: 1 })],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("idle");
        expect(server.pushes[1]?.clientId, driver).not.toBe(clientId);
        expect(server.pushes.map(Scripted.ids), driver).toEqual([[1], [1]]);
      }),
    ),
  );

  it.effect("an update the server requires keeps the outbox", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");
        const minimum = { protocol: 2, schema: 1 };

        const server = Scripted.scripted({
          push: [() => Effect.fail(new Protocol.UpdateRequired({ minimum }))],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("update-required");
        expect((yield* sync.status.get).updateRequired, driver).toEqual(
          Option.some({ minimum: Option.some(minimum) }),
        );
        expect(yield* Outbox.pending, driver).toHaveLength(1);
        expect(yield* choices, driver).toHaveLength(1);
      }),
    ),
  );

  it.effect("only a pull's `Sync.DeviceRevoked` wipes the device", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const secrets = yield* Ports.DeviceSecrets;
        yield* secrets.set("root-key", new Uint8Array(32));
        yield* enrolled;
        yield* choose("ma");

        const revokedPush = () => Effect.fail(new Protocol.DeviceRevoked());

        const once = Scripted.scripted({ push: [revokedPush], pull: [Scripted.page()] });

        expect(yield* sync.replicate(once.remote), driver).toBe("retry");
        expect(yield* choices, driver).toHaveLength(1);

        const confirmed = Scripted.scripted({
          push: [revokedPush],
          pull: [() => Effect.fail(new Protocol.DeviceRevoked())],
        });

        expect(yield* sync.replicate(confirmed.remote), driver).toBe("revoked");
        expect(yield* choices, driver).toEqual([]);
        expect(yield* Outbox.pending, driver).toEqual([]);
        expect(yield* secrets.get("root-key"), driver).toEqual(Option.none());
        expect((yield* sync.status.get).revoked, driver).toBe(true);
      }),
    ),
  );
});

const cursorOf = (space: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly version: number | null }>`
      select version from sync_space where id = ${space}
    `,
  ).pipe(Effect.map((rows) => rows[0]?.version ?? null));

const courses = Effect.flatMap(DeviceDatabase.make, (db) =>
  db.select().from(NotesDevice.Course).orderBy(NotesDevice.Course.id),
);

describe("SyncClient.replicate pages and spaces", () => {
  it.effect(
    "pages apply in order, and a space counts as synced at its Scripted.listed version",
    () =>
      onEachDevice((driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;

          const server = Scripted.scripted({
            pull: [
              Scripted.page({
                spaces: Scripted.listed(0, 2),
                patches: [
                  {
                    space: "igs",
                    reset: true,
                    to: 1,
                    ops: [Scripted.readable("Course", "ma", 1, { name: "Mathe" })],
                  },
                ],
                more: true,
              }),
              Scripted.page({
                spaces: Scripted.listed(0, 2),
                patches: [
                  {
                    space: "igs",
                    reset: false,
                    to: 2,
                    ops: [Scripted.readable("Course", "de", 2, { name: "Deutsch" })],
                  },
                  { space: "nb-lena", reset: true, to: 0, ops: [] },
                ],
                lastMutationId: 0,
              }),
            ],
          });

          expect(yield* sync.replicate(server.remote), driver).toBe("idle");
          expect(
            server.pulls.map((request) => request.cursors),
            driver,
          ).toEqual([[], [{ space: "igs", version: 1 }]]);
          expect(
            (yield* courses).map((course) => course.id),
            driver,
          ).toEqual(["de", "ma"]);
          expect(
            (yield* SyncClient.spaces.run()).map((space) =>
              Option.isSome(Option.fromNullishOr(space.syncedAt)),
            ),
            driver,
          ).toEqual([true, true]);
        }),
      ),
  );

  it.effect("a space the server stops listing, or removes, leaves with its rows", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;

        const server = Scripted.scripted({
          pull: [
            Scripted.page({ spaces: Scripted.listed().slice(0, 1) }),
            Scripted.page({ spaces: [], removed: ["nb-lena"] }),
          ],
        });

        yield* sync.replicate(server.remote);
        expect(yield* courses, driver).toEqual([]);
        expect(
          (yield* SyncClient.spaces.run()).map((space) => space.id),
          driver,
        ).toEqual(["nb-lena"]);

        yield* sync.replicate(server.remote);
        expect(yield* SyncClient.spaces.run(), driver).toEqual([]);
      }),
    ),
  );

  it.effect(
    "a Scripted.page is applied whole or not at all, and a dropped connection keeps the pages before",
    () =>
      onEachDevice((driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;

          const unlisted = Scripted.page({
            patches: [
              {
                space: "igs",
                reset: true,
                to: 1,
                ops: [Scripted.readable("Course", "ma", 1, { name: "Mathe" })],
              },
              { space: "elsewhere", reset: true, to: 1, ops: [] },
            ],
          });

          const broken = yield* Effect.exit(
            sync.replicate(Scripted.scripted({ pull: [unlisted] }).remote),
          );

          expect(Exit.hasDies(broken), driver).toBe(true);
          expect(yield* courses, driver).toEqual([]);

          const dropped = Scripted.scripted({
            pull: [
              // The Scripted.school is at version 2, and this Scripted.page brings it to 1.
              Scripted.page({
                spaces: Scripted.listed(0, 2),
                patches: [Scripted.schoolPatch],
                more: true,
              }),
              () => Effect.fail(new Replication.Disconnected()),
              Scripted.page(),
            ],
          });

          expect(Exit.isFailure(yield* Effect.exit(sync.replicate(dropped.remote))), driver).toBe(
            true,
          );
          expect(yield* cursorOf("igs"), driver).toBe(1);
          expect(yield* courses, driver).toHaveLength(5);
          expect(
            (yield* SyncClient.spaces.run()).find((space) => space.id === "igs")?.syncedAt,
            driver,
          ).toBeNull();

          yield* sync.replicate(dropped.remote);
          expect(dropped.pulls[2]?.cursors, driver).toEqual([{ space: "igs", version: 1 }]);
        }),
      ),
  );

  it.effect("a Scripted.page that moves no cursor ends the round instead of asking again", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;

        const server = Scripted.scripted({ pull: [Scripted.page({ more: true })] });

        expect(yield* sync.replicate(server.remote), driver).toBe("retry");
        expect(server.pulls, driver).toHaveLength(1);
      }),
    ),
  );
});

describe("SyncClient.replicate client ids", () => {
  it.effect("a pull's `EpochChanged` or `ClientUnknown` recovers before the next push", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");
        const { clientId } = yield* Outbox.meta;

        const server = Scripted.scripted({
          push: [Scripted.retryFirst, Scripted.applyAll, Scripted.applyAll],
          pull: [
            () =>
              Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 0 })),
            () => Effect.fail(new Protocol.ClientUnknown()),
            Scripted.page({
              syncEpoch: "epoch-2",
              patches: [Scripted.schoolPatch],
              lastMutationId: 1,
            }),
          ],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("idle");
        expect(server.pushes[1]?.syncEpoch, driver).toBe("epoch-2");
        expect(server.pushes[2]?.clientId, driver).not.toBe(clientId);
        expect(server.pushes.map(Scripted.ids), driver).toEqual([[1], [1], [1]]);
        expect(yield* Outbox.pending, driver).toEqual([]);
      }),
    ),
  );

  it.effect("a restore with a refusal in the history moves the rest to a new client id first", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;

        for (const course of ["ma", "de", "en"]) yield* choose(course);

        const reason = yield* encodeReason(new Notes.NotOffered({ course: "de" }));

        yield* sync.replicate(
          Scripted.scripted({
            push: [Scripted.applyAll],
            pull: [Scripted.page({ lastMutationId: 3, refusals: [{ mutationId: 2, reason }] })],
          }).remote,
        );

        const { clientId } = yield* Outbox.meta;

        // The restored database lost all three. 1 and 3 come back, but 2 was refused, so 3
        // can't follow 1 under this client id: 1, 3 and 4 go out as 1, 2 and 3 of a new one.
        const server = Scripted.scripted({
          push: [
            () =>
              Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 0 })),
            Scripted.applyAll,
          ],
          pull: [
            Scripted.page({
              syncEpoch: "epoch-2",
              patches: [Scripted.schoolPatch],
              lastMutationId: 3,
            }),
          ],
        });

        yield* choose("fr");
        expect(yield* sync.replicate(server.remote), driver).toBe("idle");
        expect(server.pushes[1]?.clientId, driver).not.toBe(clientId);
        expect(server.pushes.map(Scripted.ids), driver).toEqual([[4], [1, 2, 3]]);
      }),
    ),
  );

  it.effect(
    "a server waiting for a command the device lacks settles first, then renumbers the rest",
    () =>
      onEachDevice((driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;
          yield* enrolled;
          yield* choose("ma");
          yield* choose("de");
          const { clientId } = yield* Outbox.meta;

          const server = Scripted.scripted({
            push: [() => Effect.fail(new Protocol.OutOfOrder({ expected: 7 })), Scripted.applyAll],
            pull: [Scripted.page({ lastMutationId: 1 }), Scripted.page({ lastMutationId: 1 })],
          });

          expect(yield* sync.replicate(server.remote), driver).toBe("idle");
          expect(server.pushes[1]?.clientId, driver).not.toBe(clientId);
          expect(server.pushes.map(Scripted.ids), driver).toEqual([[1, 2], [1]]);
        }),
      ),
  );

  it.effect(
    "a server that counts more commands than the device made gets them under a new id",
    () =>
      onEachDevice((driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;
          yield* enrolled;
          yield* choose("ma");
          const { clientId } = yield* Outbox.meta;

          const ahead: Scripted.PushAnswer = (request) =>
            Effect.succeed({
              lastMutationId: 9,
              outcomes: request.commands.map((command) =>
                Protocol.Applied.make({ mutationId: command.mutationId }),
              ),
            });

          const server = Scripted.scripted({
            push: [ahead, Scripted.applyAll],
            pull: [Scripted.page({ lastMutationId: 1 })],
          });

          expect(yield* sync.replicate(server.remote), driver).toBe("idle");
          expect(server.pushes[1]?.clientId, driver).not.toBe(clientId);
          expect(yield* Outbox.pending, driver).toEqual([]);
        }),
      ),
  );

  it.effect("a push that moves nothing ends the round", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");

        const stuck: Scripted.PushAnswer = () =>
          Effect.succeed({ lastMutationId: 0, outcomes: [] });

        const server = Scripted.scripted({ push: [stuck], pull: [Scripted.page()] });

        expect(yield* sync.replicate(server.remote), driver).toBe("retry");
        expect(server.pushes, driver).toHaveLength(1);
      }),
    ),
  );

  it.effect("a wiped device starts over under a new client id, unless a secret stayed", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        const waiting = yield* choose("ma");
        const { clientId } = yield* Outbox.meta;

        const revoked = Scripted.scripted({
          push: [() => Effect.fail(new Protocol.DeviceRevoked())],
          pull: [() => Effect.fail(new Protocol.DeviceRevoked())],
        });

        expect(yield* sync.replicate(revoked.remote), driver).toBe("revoked");

        const meta = yield* Outbox.meta;
        expect(meta.clientId, driver).not.toBe(clientId);
        expect([meta.lastMutationId, meta.settledMutationId, meta.syncEpoch], driver).toEqual([
          0,
          0,
          null,
        ]);

        const refusal = yield* Effect.match(waiting.confirmed, {
          onFailure: (error) => error.reason._tag,
          onSuccess: () => "confirmed",
        });

        expect(refusal, driver).toBe("Sync.DeviceRevoked");
      }),
    ),
  );
});

describe("SyncClient wipe with a stuck secret", () => {
  const stuck = Layer.succeed(Ports.DeviceSecrets, {
    get: () => Effect.succeedNone,
    set: () => Effect.void,
    remove: (name) => Effect.fail(new Ports.SecretsUnavailable({ secret: name })),
  });

  it.effect("keeps the client id, so the next pull wipes again", () =>
    Effect.forEach(
      Devices.drivers,
      (driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;
          yield* enrolled;
          yield* choose("ma");
          const { clientId } = yield* Outbox.meta;

          yield* sync.replicate(
            Scripted.scripted({
              push: [Scripted.retryFirst],
              pull: [() => Effect.fail(new Protocol.DeviceRevoked())],
            }).remote,
          );

          expect((yield* Outbox.meta).clientId, driver).toBe(clientId);
          expect(yield* Outbox.pending, driver).toEqual([]);
          expect(yield* choices, driver).toEqual([]);
        }).pipe(
          Effect.provide(
            SyncClient.layer(Notes.schema).pipe(
              Layer.provideMerge(
                Layer.mergeAll(
                  Devices.session,
                  stuck,
                  TestCrypto.layer("device"),
                  Devices.disconnected,
                ),
              ),
              Layer.provideMerge(Devices.database(driver)),
            ),
          ),
          Effect.scoped,
        ),
      { discard: true },
    ),
  );
});

describe("SyncClient.replicate replays once per pull", () => {
  // The device waits to choose Mathe. One Scripted.page of a three-Scripted.page pull drops Mathe from the Scripted.school,
  // so the replay of `choice.set` refuses and its overlay row goes. The replay runs once, after
  // the last Scripted.page, wherever the change was.
  const dropMathe = {
    space: "igs",
    reset: false,
    to: 2,
    ops: [Scripted.deleted("Course", "ma", 2)],
  };

  const nothing = (to: number) => ({ space: "igs", reset: false, to, ops: [] });

  const cases = [
    { name: "on the first page", pages: [dropMathe, nothing(3), nothing(4)] },
    { name: "on the middle page", pages: [nothing(2), { ...dropMathe, to: 3 }, nothing(4)] },
    { name: "on the last page", pages: [nothing(2), nothing(3), { ...dropMathe, to: 4 }] },
  ];

  it.effect("the overlay keeps its rows between pages and drops them after the last", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const sql = yield* SqlClient.SqlClient;

        const overlay = Effect.orDie(
          Effect.provideService(rows("pending_row"), SqlClient.SqlClient, sql),
        );

        for (const { name, pages } of cases) {
          yield* sql`delete from sync_outbox`;
          yield* sql`delete from base_row`;
          yield* sql`update sync_space set version = null`;
          yield* enrolled;
          yield* choose("ma");
          const seen: Array<ReadonlyArray<{ readonly id: string }>> = [];

          const answer =
            (index: number): Scripted.PullAnswer =>
            () =>
              Effect.gen(function* () {
                if (index > 0) seen.push(yield* overlay);

                return {
                  syncEpoch: "epoch-1",
                  spaces: Scripted.listed(0, index + 2),
                  patches: [pages[index] ?? nothing(index + 2)],
                  removed: [],
                  lastMutationId: index === 2 ? 0 : null,
                  refusals: [],
                  more: index < 2,
                };
              });

          const server = Scripted.scripted({
            push: [Scripted.retryFirst],
            pull: [answer(0), answer(1), answer(2)],
          });

          yield* sync.replicate(server.remote);

          expect(seen, `${driver}, Mathe dropped ${name}`).toEqual([
            [{ id: "ma" }],
            [{ id: "ma" }],
          ]);
          expect(yield* overlay, `${driver}, Mathe dropped ${name}`).toEqual([]);
          expect((yield* Outbox.meta).replayDue, driver).toBe(false);
        }
      }),
    ),
  );

  it.effect("a pull cut between pages replays on the rows it got", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;
        yield* choose("ma");

        const server = Scripted.scripted({
          push: [Scripted.retryFirst],
          pull: [
            Scripted.page({ spaces: Scripted.listed(0, 3), patches: [dropMathe], more: true }),
            () => Effect.fail(new Replication.Disconnected()),
          ],
        });

        expect(Exit.isFailure(yield* Effect.exit(sync.replicate(server.remote))), driver).toBe(
          true,
        );
        expect(yield* rows("pending_row"), driver).toEqual([]);
        expect((yield* Outbox.meta).replayDue, driver).toBe(false);
      }),
    ),
  );

  it.effect("after a restore the screens keep their rows until the snapshot arrives", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        const sql = yield* SqlClient.SqlClient;
        yield* enrolled;
        const seen: Array<number> = [];

        const snapshot: Scripted.PullAnswer = () =>
          Effect.gen(function* () {
            seen.push(
              (yield* Effect.orDie(Effect.provideService(courses, SqlClient.SqlClient, sql)))
                .length,
            );

            return yield* Scripted.page({
              syncEpoch: "epoch-2",
              patches: [Scripted.schoolPatch],
              lastMutationId: 0,
            })(pull);
          });

        const server = Scripted.scripted({
          pull: [
            () =>
              Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 0 })),
            snapshot,
          ],
        });

        expect(yield* sync.replicate(server.remote), driver).toBe("idle");
        expect(seen, driver).toEqual([5]);
        expect(server.pulls[1]?.cursors, driver).toEqual([]);
      }),
    ),
  );

  it.effect(
    "a last Scripted.page counting more commands than the device made moves it to a new id",
    () =>
      onEachDevice((driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;
          yield* enrolled;
          yield* choose("ma");
          const { clientId } = yield* Outbox.meta;

          const server = Scripted.scripted({
            push: [Scripted.retryFirst, Scripted.applyAll],
            pull: [Scripted.page({ lastMutationId: 9 }), Scripted.page({ lastMutationId: 1 })],
          });

          // The first round ends on the server's `Retry`; the second pushes under the new id.
          yield* sync.replicate(server.remote);
          yield* sync.replicate(server.remote);

          expect(server.pushes[1]?.clientId, driver).not.toBe(clientId);
          expect(server.pushes.map(Scripted.ids), driver).toEqual([[1], [1]]);
          expect(yield* Outbox.pending, driver).toEqual([]);
        }),
      ),
  );
});

const pull: Protocol.PullRequest = {
  clientId: "client-1",
  syncEpoch: null,
  contract: Notes.schema.contract,
  cursors: [],
  settledMutationId: 0,
  limit: 10,
};

describe("SyncClient.replicate review cases", () => {
  it.effect(
    "a Scripted.page that drops one space and resets another where it was still moves on",
    () =>
      onEachDevice((driver) =>
        Effect.gen(function* () {
          const sync = yield* SyncClient.Service;

          yield* sync.replicate(
            Scripted.scripted({
              pull: [
                Scripted.page({
                  spaces: Scripted.listed(1, 1),
                  patches: [
                    Scripted.schoolPatch,
                    { space: "nb-lena", reset: true, to: 1, ops: [] },
                  ],
                }),
              ],
            }).remote,
          );

          // Before: igs at 1, nb-lena at 1. After the first page: igs at 1, other at 1.
          const other = {
            id: "other",
            kind: "notebook",
            role: "owner",
            version: 1,
            keyEpoch: null,
          };

          const server = Scripted.scripted({
            pull: [
              Scripted.page({
                spaces: [...Scripted.listed(1, 1).slice(1), other],
                patches: [{ space: "other", reset: true, to: 1, ops: [] }],
                more: true,
              }),
              Scripted.page({
                spaces: [...Scripted.listed(1, 1).slice(1), other],
                lastMutationId: 0,
              }),
            ],
          });

          expect(yield* sync.replicate(server.remote), driver).toBe("idle");
          expect(server.pulls, driver).toHaveLength(2);
        }),
      ),
  );

  it.effect("a snapshot after a restore drops the rows the restored server lost", () =>
    onEachDevice((driver) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;
        yield* enrolled;

        const snapshot = {
          ...Scripted.schoolPatch,
          ops: Scripted.schoolPatch.ops.filter((op) => op.id !== "ku"),
        };

        const server = Scripted.scripted({
          pull: [
            () =>
              Effect.fail(new Protocol.EpochChanged({ syncEpoch: "epoch-2", lastMutationId: 0 })),
            Scripted.page({ syncEpoch: "epoch-2", patches: [snapshot], lastMutationId: 0 }),
          ],
        });

        yield* sync.replicate(server.remote);
        expect(
          (yield* courses).map((course) => course.id),
          driver,
        ).toEqual(["de", "en", "fr", "ma"]);
      }),
    ),
  );

  it.effect("an engine that starts with a replay due replays first", () =>
    Effect.forEach(
      Devices.drivers,
      (driver) =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Effect.scoped(Effect.provide(Effect.andThen(enrolled, choose("ma")), engine));

          // A crash between two pages: the Scripted.school dropped Mathe, and no replay followed.
          yield* sql`delete from base_row where tbl = 'Course' and id = 'ma'`;
          yield* sql`update sync_meta set replay_due = 1`;

          yield* Effect.scoped(Effect.provide(Effect.void, engine));

          expect(yield* rows("pending_row"), driver).toEqual([]);
          expect((yield* Outbox.meta).replayDue, driver).toBe(false);
        }).pipe(Effect.provide(Devices.database(driver)), Effect.scoped),
      { discard: true },
    ),
  );
});
