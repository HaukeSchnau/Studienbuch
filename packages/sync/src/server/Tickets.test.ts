import { expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { Fixture } from "./Fixture.ts";
import { Revocations } from "./Revocations.ts";
import { Tickets } from "./Tickets.ts";

const admission = (name: string) => ({
  session: {
    accountId: `account-${name}`,
    sessionId: `session-${name}`,
    expiresAt: DateTime.makeUnsafe(Date.UTC(2027, 0, 1)),
  },
  headers: Headers.fromInput({ authorization: `Bearer session-${name}` }),
});

it.layer(
  Tickets.layer.pipe(
    Layer.provideMerge(Revocations.layer),
    Layer.provideMerge(Layer.merge(Fixture.sessions, Fixture.crypto)),
  ),
)("Tickets", (it) => {
  it.effect("a ticket opens one connection, within 30 seconds of its issue", () =>
    Effect.gen(function* () {
      const tickets = yield* Tickets.Service;
      const lena = admission("lena");
      const first = yield* tickets.issue(lena);
      const opened = [yield* tickets.redeem(first), yield* tickets.redeem(first)];
      const late = yield* tickets.issue(lena);
      yield* TestClock.adjust("30 seconds");

      expect([...opened, yield* tickets.redeem(late), yield* tickets.redeem("guessed")]).toEqual([
        Option.some(lena),
        Option.none(),
        Option.none(),
        Option.none(),
      ]);
    }),
  );

  it.effect("a session holds a few tickets at most, and none once it is revoked", () =>
    Effect.gen(function* () {
      const tickets = yield* Tickets.Service;
      const sessions = yield* Fixture.Sessions;
      const revocations = yield* Revocations.Service;
      const tom = admission("tom");

      const issued = yield* Effect.forEach(Array.from({ length: Tickets.perSession + 1 }), () =>
        tickets.issue(tom),
      );

      const [oldest, newest] = [issued[0] ?? "", issued.at(-1) ?? ""];
      const kept = yield* tickets.redeem(newest);
      const revoked = yield* Effect.forkChild(revocations.revocation(tom.session.sessionId));
      yield* sessions.revoke(tom.session.sessionId);
      yield* Fiber.join(revoked);

      expect([yield* tickets.redeem(oldest), kept, yield* tickets.redeem(issued[1] ?? "")]).toEqual(
        [Option.none(), Option.some(tom), Option.none()],
      );
    }),
  );
});
