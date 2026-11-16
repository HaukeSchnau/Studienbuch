import { assert, describe, it } from "@effect/vitest";
import * as NodeNet from "node:net";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
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

  it.live("sends over SMTP on a new connection after a 421 greeting", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* smtpServer((connection) => (connection === 1 ? "busy" : "accept"));

        yield* send(server);

        assert.deepStrictEqual(server.seen, { connections: 2, delivered: 1 });
      }),
    ),
  );

  it.live(
    "closes the connection to a server that greets and then stalls within the send timeout",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const server = yield* smtpServer(() => "stall");

          yield* Effect.flip(send(server));

          // Nodemailer's own default would keep the socket open for ten minutes.
          assert.isTrue(Option.isSome(yield* Effect.timeoutOption(server.closed, "2 seconds")));
        }),
      ),
    Duration.toMillis(Mail.sendTimeout) + 5000,
  );
});

type Greeting = "busy" | "accept" | "stall";

const decodeAddress = Schema.decodeUnknownEffect(Schema.Struct({ port: Schema.Int }));

/**
 * An SMTP server on a free local port. `greet` decides per connection, counted from 1: answer
 * `421` and hang up, take one mail, or greet and then never answer. `closed` completes when the
 * client hangs up a connection.
 */
const smtpServer = Effect.fnUntraced(function* (greet: (connection: number) => Greeting) {
  const seen = { connections: 0, delivered: 0 };
  const sockets = new Set<NodeNet.Socket>();
  const clientClosed = Deferred.makeUnsafe<void>();

  const server = yield* Effect.acquireRelease(
    Effect.callback<NodeNet.Server>((resume) => {
      const listening = NodeNet.createServer((socket) => {
        seen.connections += 1;
        sockets.add(socket);
        socket.on("close", () => Deferred.doneUnsafe(clientClosed, Effect.void));
        speak(socket, greet(seen.connections), () => (seen.delivered += 1));
      });

      listening.listen(0, "127.0.0.1", () => resume(Effect.succeed(listening)));
    }),
    (listening) =>
      Effect.sync(() => {
        listening.close();

        for (const socket of sockets) socket.destroy();
      }),
  );

  const { port } = yield* decodeAddress(server.address()).pipe(Effect.orDie);

  return { url: `smtp://127.0.0.1:${port}`, seen, closed: Deferred.await(clientClosed) };
});

/** Just enough SMTP for nodemailer to hand over one mail without TLS or a login. */
const speak = (socket: NodeNet.Socket, greeting: Greeting, delivered: () => void) => {
  if (greeting === "busy") {
    socket.end("421 Too busy\r\n");

    return;
  }

  socket.write("220 test ESMTP\r\n");

  // A socket nobody reads never sees the client hang up.
  if (greeting === "stall") {
    socket.resume();

    return;
  }

  let buffered = "";
  let inData = false;

  socket.on("data", (chunk) => {
    buffered += chunk.toString("latin1");
    const lines = buffered.split("\r\n");
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (inData) {
        if (line === ".") {
          inData = false;
          delivered();
          socket.write("250 Queued\r\n");
        }
      } else if (line.startsWith("DATA")) {
        inData = true;
        socket.write("354 Go ahead\r\n");
      } else if (line.startsWith("QUIT")) {
        socket.end("221 Bye\r\n");
      } else {
        socket.write("250 OK\r\n");
      }
    }
  });
};

const send = (server: { readonly url: string }) =>
  Effect.provide(
    Effect.gen(function* () {
      const mail = yield* Mail.Service;

      yield* mail.send({ to: "student@example.test", subject: "Test", text: "Test" });
    }),
    Mail.layerSmtp(Redacted.make(server.url), "studienbuch@example.test"),
  );
