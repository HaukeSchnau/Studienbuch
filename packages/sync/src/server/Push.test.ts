import { describe, expect, layer } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as SqlClient from "effect/sql/SqlClient";
import { Command } from "../protocol/Command.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Fixture } from "./Fixture.ts";
import { Pull } from "./Pull.ts";
import { Push } from "./Push.ts";
import { SyncEpoch } from "./SyncEpoch.ts";

const at = DateTime.makeUnsafe(0);
const { contract } = Fixture.definition;

type School = Effect.Success<ReturnType<typeof Fixture.school>>;

const push = (account: string, clientId: string, commands: ReadonlyArray<Command.Any>) =>
  Effect.flatMap(Push.Service, (service) =>
    service.push(account, { clientId, syncEpoch: null, contract, commands }),
  );

const pull = (
  account: string,
  clientId: string,
  settledMutationId = 0,
  cursors: ReadonlyArray<typeof Protocol.Cursor.Type> = [],
) =>
  Effect.flatMap(Pull.Service, (service) =>
    service.pull(account, {
      clientId,
      syncEpoch: null,
      contract,
      cursors,
      settledMutationId,
      limit: 1000,
    }),
  );

/** What a push answered, as tags: an outcome's, a refusal's, or the error's. */
const answer = <R>(effect: Effect.Effect<Protocol.PushResponse, { readonly _tag: string }, R>) =>
  effect.pipe(
    Effect.map(({ lastMutationId, outcomes }) => ({
      lastMutationId,
      outcomes: outcomes.map((outcome) =>
        outcome._tag === "Rejected"
          ? `${outcome.mutationId} ${outcome.reason._tag}`
          : `${outcome.mutationId} ${outcome._tag}`,
      ),
    })),
    Effect.catch((error) => Effect.succeed(error._tag)),
  );

const enroll = (
  mutationId: number,
  world: School,
  args: {
    readonly notebook?: string;
    readonly school?: string;
    readonly courseIds?: ReadonlyArray<string>;
  },
) =>
  Command.Mutate.make({
    mutationId,
    name: Fixture.setEnrollment.name,
    version: 1,
    args: {
      notebook: args.notebook ?? world.lena.notebook,
      school: args.school ?? world.school,
      termId: world.term,
      courseIds: args.courseIds ?? [],
    },
    at,
  });

const seal = (
  mutationId: number,
  writes: ReadonlyArray<Command.SealedWrite>,
  boxes: Command.Seal["boxes"] = [],
) => Command.Seal.make({ mutationId, at, writes, boxes, links: [] });

const write = (
  space: string,
  id: string,
  author: string,
  options: {
    readonly base?: Command.Base;
    readonly keyEpoch?: number;
    readonly ct?: Uint8Array | null;
    readonly format?: number;
  } = {},
): Command.SealedWrite => ({
  space,
  id,
  base: options.base ?? Command.Absent.make({}),
  envelope: Fixture.envelope(author, options.keyEpoch, options.format),
  ct: options.ct === undefined ? new Uint8Array(32) : options.ct,
});

/** Opens key epoch 0 of the student's notebook, as the first device does with its first write. */
const openNotebook = (student: School["lena"], clientId: string) =>
  push(student.account, clientId, [
    seal(
      1,
      [write(student.notebook, `${clientId}-first`, student.account)],
      [Fixture.keyBox(student.notebook, student.account)],
    ),
  ]);

describe.skipIf(Postgres18.socket === null)("Push on PostgreSQL 18", () => {
  layer(Fixture.server)((it) => {
    it.effect(
      "a re-sent push reports its earlier outcomes, and a gap or a foreign client fails it",
      () =>
        Effect.gen(function* () {
          const world = yield* Fixture.school("resend");
          const { lena, tom } = world;

          const commands = [
            enroll(1, world, { courseIds: ["ma"] }),
            enroll(2, world, { courseIds: ["no-such-course"] }),
          ];

          const first = yield* answer(push(lena.account, "resend-c1", commands));
          const again = yield* answer(push(lena.account, "resend-c1", commands));

          expect(first).toEqual({
            lastMutationId: 2,
            outcomes: ["1 Applied", "2 Enrollment.UnknownCourse"],
          });

          expect(again).toEqual(first);
          expect(yield* answer(push(lena.account, "resend-c1", [enroll(4, world, {})]))).toBe(
            "Sync.OutOfOrder",
          );
          expect(yield* answer(push(tom.account, "resend-c1", [enroll(3, world, {})]))).toBe(
            "Sync.ClientUnknown",
          );
          // A client the server never saw can't start at 2: it forgot the client's earlier commands.
          expect(yield* answer(push(lena.account, "resend-c2", [enroll(2, world, {})]))).toBe(
            "Sync.ClientUnknown",
          );

          const refusals = (settled: number) =>
            Effect.map(pull(lena.account, "resend-c1", settled), (response) =>
              response.refusals.map(({ mutationId, reason }) => `${mutationId} ${reason._tag}`),
            );

          expect([yield* refusals(0), yield* refusals(2)]).toEqual([
            ["2 Enrollment.UnknownCourse"],
            [],
          ]);
        }),
    );

    it.effect("a readable command runs again on the server, which refuses what it may not do", () =>
      Effect.gen(function* () {
        const world = yield* Fixture.school("mutate");
        const other = yield* Fixture.school("mutate-other");
        const { lena, tom } = world;
        const [ma, de] = [world.courseSpace("ma"), world.courseSpace("de")];

        const outcomes = yield* answer(
          push(lena.account, "mutate-c1", [
            enroll(1, world, { courseIds: world.courses }),
            // Another school's term and courses: Lena's Tx doesn't see that school's rows.
            enroll(2, world, { school: other.school, courseIds: other.courses }),
            enroll(3, world, { notebook: tom.notebook }),
            enroll(4, world, { notebook: world.school }),
            Command.Mutate.make({
              mutationId: 5,
              name: "homework.create",
              version: 1,
              args: {},
              at,
            }),
            Command.Mutate.make({
              mutationId: 6,
              name: "enrollment.set",
              version: 1,
              args: {},
              at,
            }),
            Command.Mutate.make({
              mutationId: 7,
              name: "enrollment.set",
              version: 2,
              args: {},
              at,
            }),
            enroll(8, world, {}),
          ]),
        );

        expect(outcomes).toEqual({
          lastMutationId: 6,
          outcomes: [
            "1 Applied",
            "2 Enrollment.UnknownTerm",
            `3 Sync.NotMember`,
            "4 Sync.NotAllowed",
            // A sealed mutator isn't a readable command's.
            "5 Sync.UnknownMutator",
            "6 Sync.InvalidArgs",
            // A newer app than this server: the batch stops and the command waits.
            "7 Retry",
          ],
        });

        const { spaces } = yield* pull(lena.account, "mutate-c1");

        expect(spaces.map(({ id, role }) => `${id} ${role}`)).toEqual([
          `${de} reader`,
          `${lena.notebook} owner`,
          `${ma} reader`,
          `${world.school} reader`,
        ]);
      }),
    );

    it.effect(
      "each Seal check refuses with its tag, in order, and Stale keeps the last mutation id",
      () =>
        Effect.gen(function* () {
          const { lena, tom, school } = yield* Fixture.school("checks");
          yield* openNotebook(lena, "checks-open");
          const large = new Uint8Array(Command.maxSealedBytes + 1);

          // Each case breaks its own check and every later one, so only the order decides the answer.
          const cases = [
            [
              "NotMember: another author",
              write(lena.notebook, "a", tom.account, { ct: large, format: 2 }),
            ],
            [
              "NotMember: another notebook",
              write(tom.notebook, "b", lena.account, { ct: large, format: 2 }),
            ],
            [
              "NotAllowed: a readable space",
              write(school, "c", lena.account, { ct: large, format: 2 }),
            ],
            [
              "Stale: an old key epoch",
              write(lena.notebook, "d", lena.account, { keyEpoch: 1, ct: large, format: 2 }),
            ],
            [
              "Stale: a moved row",
              write(lena.notebook, "checks-open-first", lena.account, { ct: large, format: 2 }),
            ],
            [
              "BadEnvelope: an unknown format",
              write(lena.notebook, "f", lena.account, { ct: large, format: 2 }),
            ],
            ["TooLarge", write(lena.notebook, "g", lena.account, { ct: large })],
          ] as const;

          const answers = [];

          for (const [name, sealed] of cases) {
            const answered = yield* answer(
              push(lena.account, `checks-${name}`, [seal(1, [sealed])]),
            );

            answers.push([name, answered]);
          }

          expect(answers).toEqual([
            ["NotMember: another author", { lastMutationId: 1, outcomes: ["1 Sync.NotMember"] }],
            ["NotMember: another notebook", { lastMutationId: 1, outcomes: ["1 Sync.NotMember"] }],
            [
              "NotAllowed: a readable space",
              { lastMutationId: 1, outcomes: ["1 Sync.NotAllowed"] },
            ],
            ["Stale: an old key epoch", { lastMutationId: 0, outcomes: ["1 Stale"] }],
            ["Stale: a moved row", { lastMutationId: 0, outcomes: ["1 Stale"] }],
            [
              "BadEnvelope: an unknown format",
              { lastMutationId: 1, outcomes: ["1 Sync.BadEnvelope"] },
            ],
            ["TooLarge", { lastMutationId: 1, outcomes: ["1 Sync.TooLarge"] }],
          ]);
        }),
    );

    it.effect("a notebook's key epoch 0 opens once, with one box for each member", () =>
      Effect.gen(function* () {
        const { lena, tom } = yield* Fixture.school("epochs");
        const box = Fixture.keyBox(lena.notebook, lena.account);

        const outcomes = [
          // No epoch yet, and no box to open one.
          yield* answer(
            push(lena.account, "epochs-a", [seal(1, [write(lena.notebook, "x", lena.account)])]),
          ),
          // A box for someone who isn't a member.
          yield* answer(
            push(lena.account, "epochs-b", [
              seal(1, [], [box, Fixture.keyBox(lena.notebook, tom.account, lena.account)]),
            ]),
          ),
          yield* answer(
            push(lena.account, "epochs-c", [
              seal(1, [write(lena.notebook, "x", lena.account)], [box]),
            ]),
          ),
          // A second device opened epoch 0 offline too: it pulls, takes the box and seals again.
          yield* answer(
            push(lena.account, "epochs-d", [
              seal(1, [write(lena.notebook, "y", lena.account)], [box]),
            ]),
          ),
          yield* answer(
            push(lena.account, "epochs-d", [seal(1, [write(lena.notebook, "y", lena.account)])]),
          ),
          // A command whose replay failed on the device uses up its id with an empty Seal.
          yield* answer(push(lena.account, "epochs-d", [seal(2, [])])),
        ];

        expect(outcomes).toEqual([
          { lastMutationId: 0, outcomes: ["1 Stale"] },
          { lastMutationId: 0, outcomes: ["1 Stale"] },
          { lastMutationId: 1, outcomes: ["1 Applied"] },
          { lastMutationId: 0, outcomes: ["1 Stale"] },
          { lastMutationId: 1, outcomes: ["1 Applied"] },
          { lastMutationId: 2, outcomes: ["2 Applied"] },
        ]);

        const { spaces, patches } = yield* pull(lena.account, "epochs-d", 2);
        const notebook = patches.find((patch) => patch.space === lena.notebook);

        expect(spaces.find((space) => space.id === lena.notebook)?.keyEpoch).toBe(0);
        expect(notebook?.ops.map((op) => `${op.tbl}/${op.id} ${op.row._tag}`)).toEqual([
          "/x Sealed",
          `${Protocol.keyBoxTable}/${Protocol.keyBoxId(box)} Readable`,
          "/y Sealed",
        ]);
      }),
    );

    it.effect(
      "a batch writes one row twice through AfterMutation, and a delete leaves a tombstone",
      () =>
        Effect.gen(function* () {
          const { lena } = yield* Fixture.school("batch");
          yield* openNotebook(lena, "batch-c1");
          const second = Command.AfterMutation.make({ mutationId: 2 });

          const outcomes = yield* answer(
            push(lena.account, "batch-c1", [
              seal(2, [write(lena.notebook, "row", lena.account)]),
              seal(3, [write(lena.notebook, "row", lena.account, { base: second })]),
              // Command 3 wrote the row last, so a write based on command 2 is stale.
              seal(4, [write(lena.notebook, "row", lena.account, { base: second, ct: null })]),
            ]),
          );

          expect(outcomes).toEqual({
            lastMutationId: 3,
            outcomes: ["2 Applied", "3 Applied", "4 Stale"],
          });
          const version = Command.AtVersion.make({ version: 3 });

          expect(
            yield* answer(
              push(lena.account, "batch-c1", [
                seal(4, [write(lena.notebook, "row", lena.account, { base: version, ct: null })]),
              ]),
            ),
          ).toEqual({ lastMutationId: 4, outcomes: ["4 Applied"] });

          // A device that holds version 3 gets the delete. A new device gets live rows only.
          const { patches } = yield* pull(lena.account, "batch-c1", 4, [
            { space: lena.notebook, version: 3 },
          ]);

          expect(patches.find((patch) => patch.space === lena.notebook)?.ops).toEqual([
            { tbl: "", id: "row", version: 4, row: Protocol.Deleted.make({}) },
          ]);
        }),
    );

    it.effect("a push and a pull with another restore epoch or an old contract fail whole", () =>
      Effect.gen(function* () {
        const world = yield* Fixture.school("gates");
        const { lena } = world;
        yield* push(lena.account, "gates-c1", [enroll(1, world, {})]);
        const syncEpoch = yield* SyncEpoch.current;
        const service = yield* Push.Service;
        const strict = yield* Push.make({ protocol: 1, schema: 2 });
        const request = { clientId: "gates-c1", contract, commands: [enroll(2, world, {})] };

        expect(
          yield* Effect.flip(service.push(lena.account, { ...request, syncEpoch: "restored" })),
        ).toEqual(new Protocol.EpochChanged({ syncEpoch, lastMutationId: 1 }));

        expect(yield* Effect.flip(strict.push(lena.account, { ...request, syncEpoch }))).toEqual(
          new Protocol.UpdateRequired({ minimum: { protocol: 1, schema: 2 } }),
        );
      }),
    );

    it.effect(
      "concurrent pushes into one space commit in version order, and a puller skips nothing and never sees the last mutation id lead its rows",
      () =>
        Effect.gen(function* () {
          const { lena } = yield* Fixture.school("busy");
          yield* openNotebook(lena, "busy-open");
          const pulls = yield* Pull.Service;
          const sql = yield* SqlClient.SqlClient;
          const clients = ["busy-a", "busy-b", "busy-c", "busy-d"];
          const commands = 12;

          const writers = Effect.forEach(
            clients,
            (client) =>
              Effect.forEach(
                Array.from({ length: commands }, (_, index) => index + 1),
                (mutationId) =>
                  push(lena.account, client, [
                    seal(mutationId, [
                      write(lena.notebook, `${client}-${mutationId}`, lena.account),
                    ]),
                  ]),
                { discard: true },
              ),
            { concurrency: "unbounded", discard: true },
          );

          const finish = yield* Deferred.make<void>();

          const done = yield* Effect.forkChild(
            Effect.andThen(writers, Deferred.succeed(finish, undefined)),
          );

          const seen = new Map<string, number>();
          let cursor: number | undefined;
          let leads = 0;
          let finished = false;

          // The puller polls on purpose: it is a device pulling while writers commit.
          while (!finished) {
            finished = yield* Deferred.isDone(finish);

            const response = yield* pulls
              .pull(lena.account, {
                clientId: "busy-a",
                syncEpoch: null,
                contract,
                cursors: cursor === undefined ? [] : [{ space: lena.notebook, version: cursor }],
                settledMutationId: 0,
                limit: 1000,
              })
              .pipe(Effect.orDie);

            for (const patch of response.patches.filter((each) => each.space === lena.notebook)) {
              for (const op of patch.ops) if (op.tbl === "") seen.set(op.id, op.version);
              cursor = patch.to;
            }

            // Every command up to the last mutation id must already have its row here.
            for (let id = 1; id <= (response.lastMutationId ?? 0); id++) {
              if (!seen.has(`busy-a-${id}`)) leads++;
            }
          }

          yield* Fiber.join(done);

          const stored = yield* sql<{ readonly id: string; readonly version: number }>`
            select id, version::float8 as version from sync_row
            where space_id = ${lena.notebook} and tbl = '' order by version
          `;

          expect(leads).toBe(0);
          expect(new Map(stored.map(({ id, version }) => [id, version]))).toEqual(seen);
          expect(stored.map(({ version }) => version)).toEqual(stored.map((_, index) => index + 1));
          expect(stored).toHaveLength(1 + clients.length * commands);
        }),
    );
  });
});
