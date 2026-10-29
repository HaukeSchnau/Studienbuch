import { describe, expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Socket from "effect/socket/Socket";
import * as TestClock from "effect/testing/TestClock";
import { Link } from "./Link.ts";

const ignore = () => Effect.void;

/** Starts reading an end, which for the device's end waits until its socket opens. */
const read = (socket: Socket.Socket) => Socket.readerString(socket);

/** Both ends read, so the device's socket is open and each end can write. */
const connected = Effect.gen(function* () {
  const link = yield* Link.make(ignore);
  const device = yield* Effect.forkChild(read(link.device));
  const server = yield* read(link.server);

  return { link, device: yield* Fiber.join(device), server };
});

describe("Link", () => {
  it.effect("the device's socket opens only once the server reads its end", () =>
    Effect.gen(function* () {
      const link = yield* Link.make(ignore);
      const opening = yield* Effect.forkChild(read(link.device));

      // Less than the 10 seconds Effect's socket waits for "open".
      yield* TestClock.adjust("5 seconds");
      expect(opening.pollUnsafe()).toBeUndefined();

      yield* Effect.asVoid(read(link.server));
      yield* Effect.asVoid(Fiber.join(opening));
    }),
  );

  it.effect("a frame that arrives before its end reads waits for the reader", () =>
    Effect.gen(function* () {
      const arrived = yield* Deferred.make<void>();

      const link = yield* Link.make((direction) =>
        direction === "down" ? Deferred.succeed(arrived, undefined) : Effect.void,
      );

      // The server reads, so the device's socket opens, but nothing reads the device's end yet.
      yield* Effect.asVoid(read(link.server));
      yield* (yield* link.server.writer).write("hello");
      yield* Deferred.await(arrived);

      const pulled = yield* Effect.forkChild(Effect.flatten(read(link.device)));
      yield* TestClock.adjust("1 second");
      expect(pulled.pollUnsafe()).toStrictEqual(Exit.succeed(["hello"]));
    }),
  );

  it.effect("a close travels with its code, and sever closes both ends with 1006", () =>
    Effect.gen(function* () {
      const closing = yield* connected;
      const deviceWriter = yield* closing.link.device.writer;

      yield* deviceWriter.write(new Socket.CloseEvent(4401));
      expect(yield* closing.link.closed).toBe(4401);
      expect(yield* Effect.flip(closing.server)).toMatchObject({ reason: { code: 4401 } });

      const severed = yield* connected;

      yield* severed.link.sever;
      expect(yield* severed.link.closed).toBe(Link.abnormalClosure);
      expect(yield* Effect.flip(severed.device)).toMatchObject({ reason: { code: 1006 } });
      expect(yield* Effect.flip(severed.server)).toMatchObject({ reason: { code: 1006 } });
    }),
  );
});
