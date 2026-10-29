import { expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { Fixture } from "./Fixture.ts";
import { Tickets } from "./Tickets.ts";

const session = {
  accountId: "account-lena",
  sessionId: "session-lena",
  expiresAt: DateTime.makeUnsafe(Date.UTC(2027, 0, 1)),
};

it.layer(Tickets.layer.pipe(Layer.provide(Fixture.crypto)))("Tickets", (it) => {
  it.effect("a ticket opens one connection, within 30 seconds of its issue", () =>
    Effect.gen(function* () {
      const tickets = yield* Tickets.Service;
      const first = yield* tickets.issue(session);
      const opened = [yield* tickets.redeem(first), yield* tickets.redeem(first)];
      const late = yield* tickets.issue(session);
      yield* TestClock.adjust("30 seconds");

      expect([...opened, yield* tickets.redeem(late), yield* tickets.redeem("guessed")]).toEqual([
        Option.some(session),
        Option.none(),
        Option.none(),
        Option.none(),
      ]);
    }),
  );
});
