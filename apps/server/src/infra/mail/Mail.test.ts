import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import { Mail } from "./Mail.ts";

// Failures as `layerSmtp` keeps nodemailer's: a server greeting with "421 Too busy", a mailbox
// that's busy or refused, a connection that dropped, a wrong login, and nodemailer's own timeout.
const busy = new Mail.SendFailed({ code: "EPROTOCOL", responseCode: 421 });
const mailboxBusy = new Mail.SendFailed({ code: "EENVELOPE", responseCode: 450 });
const dropped = new Mail.SendFailed({ code: "ECONNECTION" });
const refused = new Mail.SendFailed({ code: "EENVELOPE", responseCode: 550 });
const wrongLogin = new Mail.SendFailed({ code: "EAUTH", responseCode: 535 });
const silent = new Mail.SendFailed({ code: "ETIMEDOUT" });

/** Whether a mail whose tries fail with `failures` in turn, and then succeed, went out, and in how many tries. */
const outcome = Effect.fnUntraced(function* (failures: ReadonlyArray<Mail.SendFailed>) {
  const tries = yield* Ref.make(0);

  const attempt = Effect.flatMap(
    Ref.getAndUpdate(tries, (count) => count + 1),
    (count) =>
      Option.match(Option.fromNullishOr(failures[count]), {
        onNone: () => Effect.void,
        onSome: Effect.fail,
      }),
  );

  const sending = yield* Effect.forkChild(Effect.exit(Mail.retried(attempt)), {
    startImmediately: true,
  });

  yield* TestClock.adjust(Mail.sendTimeout);

  return { sent: Exit.isSuccess(yield* Fiber.join(sending)), tries: yield* Ref.get(tries) };
});

describe("Mail", () => {
  it.effect(
    "tries a mail again only after a 4xx reply or a dropped connection, three times at most",
    () =>
      Effect.gen(function* () {
        const outcomes = yield* Effect.forEach(
          [[busy, dropped], [mailboxBusy, busy, dropped], [refused], [wrongLogin], [silent]],
          outcome,
        );

        assert.deepStrictEqual(outcomes, [
          { sent: true, tries: 3 },
          { sent: false, tries: 3 },
          { sent: false, tries: 1 },
          { sent: false, tries: 1 },
          { sent: false, tries: 1 },
        ]);
      }),
  );

  it.effect("gives up on a server that never answers", () =>
    Effect.gen(function* () {
      const sending = yield* Effect.forkChild(Effect.flip(Mail.retried(Effect.never)), {
        startImmediately: true,
      });

      yield* TestClock.adjust(Mail.sendTimeout);

      assert.strictEqual((yield* Fiber.join(sending)).code, "timeout");
    }),
  );
});
