import { describe, expect, layer } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Exit from "effect/Exit";
import * as Headers from "effect/http/Headers";
import * as Queue from "effect/Queue";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Scope from "effect/Scope";
import * as Socket from "effect/socket/Socket";
import * as TestClock from "effect/testing/TestClock";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Link } from "../simulation/Link.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Connections } from "./Connections.ts";
import { Contract } from "./Contract.ts";
import { Fixture } from "./Fixture.ts";
import type { Ports } from "./Ports.ts";
import { Pull } from "./Pull.ts";
import { Revocations } from "./Revocations.ts";

/** A session that ends an hour from now. Tests share their clock, which an earlier one moved. */
const sessionOf = (name: string) =>
  Effect.map(Clock.currentTimeMillis, (now) => ({
    accountId: `${name}-lena`,
    sessionId: `${name}-session`,
    expiresAt: DateTime.makeUnsafe(now + 60 * 60 * 1000),
  }));

const headersOf = (sessionId: string) =>
  Headers.fromInput({ authorization: `Bearer ${sessionId}` });

/** A device's connection over an in-memory socket, and the code it closed with. */
const connect = Effect.fnUntraced(function* (
  connections: Connections.Service["Service"],
  session: Ports.ResolvedSession,
  headers?: Headers.Headers,
) {
  const link = yield* Link.make(() => Effect.void);
  yield* Effect.forkScoped(Effect.scoped(connections.serve(session, link.server, headers)));

  const protocol = yield* RpcClient.makeProtocolSocket({ retryTransientErrors: false }).pipe(
    Effect.provideService(Socket.Socket, link.device),
    Effect.provide(Protocol.serialization),
  );

  const client = yield* RpcClient.make(Protocol.Rpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocol),
  );

  // An answered pull shows the connection is up and waiting for whatever ends it.
  const pull = client["Sync.pull"]({
    clientId: `${session.sessionId}-device`,
    syncEpoch: null,
    contract: Fixture.definition.contract,
    cursors: [],
    settledMutationId: 0,
    limit: 100,
  });

  return { pull, closed: link.closed };
});

describe.skipIf(Postgres18.socket === null)("Connections on PostgreSQL 18", () => {
  layer(Fixture.server)((it) => {
    it.effect("a connection ends with 1000 when its session's term does", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const connections = yield* Connections.Service;
          const { pull, closed } = yield* connect(connections, yield* sessionOf("term"));
          yield* pull;
          yield* TestClock.adjust("1 hour");

          expect(yield* closed).toBe(1000);
        }),
      ),
    );

    it.effect("a session revoked before its connection opens closes it with 4401 at once", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const connections = yield* Connections.Service;
          const sessions = yield* Fixture.Sessions;
          const revocations = yield* Revocations.Service;
          const session = yield* sessionOf("early");
          yield* sessions.add(session);
          const revoked = yield* Effect.forkChild(revocations.revocation(session.sessionId));
          yield* sessions.revoke(session.sessionId);
          yield* Fiber.join(revoked);
          const { closed } = yield* connect(connections, session);

          expect(yield* closed).toBe(Connection.CloseCode.sessionEnded);
        }),
      ),
    );

    it.effect(
      "a session that stops resolving unannounced closes its connection within minutes, and a failed check waits for the next",
      () =>
        Effect.scoped(
          Effect.gen(function* () {
            const connections = yield* Connections.Service;
            const sessions = yield* Fixture.Sessions;
            const session = yield* sessionOf("lapsed");
            yield* sessions.add(session);

            const { pull, closed } = yield* connect(
              connections,
              session,
              headersOf(session.sessionId),
            );

            yield* pull;
            yield* sessions.outage(true);
            yield* TestClock.adjust("6 minutes");
            yield* sessions.outage(false);
            yield* pull;
            yield* sessions.forget(session.sessionId);
            yield* TestClock.adjust("6 minutes");

            expect(yield* closed).toBe(Connection.CloseCode.sessionEnded);
          }),
        ),
    );

    it.effect("a session's connection past the cap closes its oldest with 1008", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const connections = yield* Connections.Service;
          const session = yield* sessionOf("crowd");
          const oldest = yield* connect(connections, session);
          yield* oldest.pull;

          for (let index = 0; index < Connections.perSession; index++) {
            yield* (yield* connect(connections, session)).pull;
          }

          expect(yield* oldest.closed).toBe(1008);
        }),
      ),
    );

    it.effect("a session's sockets pull one at a time, and other sessions go on", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const pull = yield* Pull.Service;
          const gate = yield* Deferred.make<void>();
          const entered = yield* Queue.unbounded<string>();

          // Lena's first pull holds its turn until the gate opens.
          const gated = Pull.Service.of({
            pull: (account, request) =>
              Queue.offer(entered, account).pipe(
                Effect.andThen(account === "turns-lena" ? Deferred.await(gate) : Effect.void),
                Effect.andThen(pull.pull(account, request)),
              ),
          });

          const connections = yield* Connections.make(Contract.initialMinimum).pipe(
            Effect.provideService(Pull.Service, gated),
          );

          const lena = yield* sessionOf("turns");
          const first = yield* connect(connections, lena);
          const second = yield* connect(connections, lena);
          const other = yield* connect(connections, yield* sessionOf("others"));
          const holding = yield* Effect.forkChild(first.pull);
          const holder = yield* Queue.take(entered);
          const waiting = yield* Effect.forkChild(second.pull);
          yield* other.pull;
          const whileHeld = yield* Queue.takeAll(entered);
          yield* Deferred.succeed(gate, undefined);
          yield* Fiber.join(holding);
          yield* Fiber.join(waiting);

          expect([holder, whileHeld, yield* Queue.takeAll(entered)]).toEqual([
            "turns-lena",
            ["others-lena"],
            ["turns-lena"],
          ]);
        }),
      ),
    );

    it.effect("a server shutting down closes its connections with 1012", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const scope = yield* Scope.make();

          const connections = yield* Scope.provide(scope)(
            Connections.make(Contract.initialMinimum),
          );

          const { pull, closed } = yield* connect(connections, yield* sessionOf("shutdown"));
          yield* pull;
          yield* Scope.close(scope, Exit.void);

          expect(yield* closed).toBe(1012);
        }),
      ),
    );
  });
});
