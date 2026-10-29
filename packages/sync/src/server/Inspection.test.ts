import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Schema from "effect/Schema";
import { Command } from "../protocol/Command.ts";
import { Inspect } from "../protocol/Inspect.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Fixture } from "./Fixture.ts";
import { Inspection } from "./Inspection.ts";
import { Push } from "./Push.ts";
import { SyncServer } from "./SyncServer.ts";

const encodeResponse = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(Inspect.Response)),
);

describe.skipIf(Postgres18.socket === null)("Inspection on PostgreSQL 18", () => {
  layer(Fixture.server)((it) => {
    it.effect("shows envelopes and ciphertext sizes, and no byte of what a sealed row holds", () =>
      Effect.gen(function* () {
        const { lena, school } = yield* Fixture.school("inspect");
        const push = yield* Push.Service;
        // What a device sealed. Whatever the server shows of it, these bytes never appear.
        const ct = new TextEncoder().encode("MARKER-Mathe-Hausaufgabe");

        const sealed = (mutationId: number, envelope = Fixture.envelope(lena.account)) =>
          Command.Seal.make({
            mutationId,
            at: DateTime.makeUnsafe(0),
            writes: [
              {
                space: lena.notebook,
                id: "row",
                base:
                  mutationId === 1
                    ? Command.Absent.make({})
                    : Command.AfterMutation.make({ mutationId: 1 }),
                envelope,
                ct,
              },
            ],
            boxes: mutationId === 1 ? [Fixture.keyBox(lena.notebook, lena.account)] : [],
            links: [],
          });

        yield* push.push(lena.account, {
          clientId: "inspect-device",
          syncEpoch: null,
          contract: Fixture.definition.contract,
          // The second write is refused, which the command log shows.
          commands: [sealed(1), sealed(2, Fixture.envelope(lena.account, 0, 2))],
        });

        const response = yield* Inspection.snapshot({
          spaces: [lena.notebook, school],
          clients: ["inspect-device"],
          limit: 10,
        });

        const json = yield* encodeResponse(response);
        const notebook = response.rows.filter((row) => row.space === lena.notebook);

        expect(notebook.map(({ tbl, id, row }) => `${tbl}/${id} ${row._tag}`)).toEqual([
          "/row Sealed",
          `_key/0:${lena.account} Readable`,
        ]);

        expect(notebook[0]?.row).toEqual(
          Inspect.Sealed.make({
            envelope: { format: 1, suite: 1, keyEpoch: 0, author: lena.account },
            bytes: ct.length,
          }),
        );

        expect(
          response.commands.map(
            (command) => `${command.mutationId} ${command.reason?._tag ?? "Applied"}`,
          ),
        ).toEqual(["2 Sync.BadEnvelope", "1 Applied"]);

        expect(
          response.spaces.map(({ id, members }) => [id, members.map(({ account }) => account)]),
        ).toEqual([
          [lena.notebook, [lena.account]],
          [school, [lena.account, `inspect-tom`]],
        ]);

        for (const encoding of ["utf8", "base64", "hex"] as const) {
          expect(json).not.toContain(Buffer.from(ct).toString(encoding));
        }
      }),
    );
  });
});

/** `Sync.inspect` over HTTP, as the Sync Lab asks it, on a server that answers or doesn't. */
const served = (answers: boolean) =>
  HttpRouter.serve(SyncServer.inspection(answers), {
    disableLogger: true,
    disableListenLog: true,
  }).pipe(Layer.provideMerge(NodeHttpServer.layerTest), Layer.provideMerge(Fixture.server));

/** What `Sync.inspect` answers with `authorization`, as a tag. */
const ask = (authorization: string | null) =>
  Effect.gen(function* () {
    const server = yield* HttpServer.HttpServer;
    const url = new URL(Inspect.path, HttpServer.formatAddress(server.address));

    const client = yield* RpcClient.make(Inspect.Rpcs).pipe(
      Effect.provide(
        RpcClient.layerProtocolHttp({ url: url.toString() }).pipe(
          Layer.provide([FetchHttpClient.layer, Inspect.serialization]),
        ),
      ),
    );

    return yield* client["Sync.inspect"](
      { spaces: [], clients: [], limit: 1 },
      { headers: authorization === null ? {} : { authorization } },
    ).pipe(
      Effect.as("answered"),
      Effect.catchTags({ "Inspect.Unavailable": (error) => Effect.succeed(error._tag) }),
    );
  }).pipe(Effect.scoped);

const lena = {
  accountId: "inspect-lena",
  sessionId: "inspect-session",
  expiresAt: DateTime.makeUnsafe(Date.UTC(2100, 0, 1)),
};

describe.skipIf(Postgres18.socket === null)("Sync.inspect over HTTP", () => {
  // The real clock: a real HTTP server and client talk here.
  layer(served(true), { excludeTestServices: true })((it) => {
    it.effect("a development or preview server answers only a request with a session", () =>
      Effect.gen(function* () {
        yield* (yield* Fixture.Sessions).add(lena);

        expect([
          yield* ask(null),
          yield* ask("Bearer guessed"),
          yield* ask(`Bearer ${lena.sessionId}`),
        ]).toEqual(["Inspect.Unavailable", "Inspect.Unavailable", "answered"]);
      }),
    );
  });

  layer(served(false), { excludeTestServices: true })((it) => {
    it.effect("another server answers no one", () =>
      Effect.gen(function* () {
        yield* (yield* Fixture.Sessions).add(lena);

        expect(yield* ask(`Bearer ${lena.sessionId}`)).toBe("Inspect.Unavailable");
      }),
    );
  });
});
