import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

// When the Übersicht says that the device is offline.

export * as Offline from "./Offline.ts";

/**
 * Whether to show the device as offline, given whether its engine has a connection. The engine
 * passes through "offline" between its attempts to connect, so going offline shows after 2 seconds,
 * and coming back shows at once.
 */
export const shown = (disconnected: Stream.Stream<boolean>): Stream.Stream<boolean> =>
  disconnected.pipe(
    Stream.changes,
    Stream.switchMap((offline) =>
      offline
        ? Stream.fromEffect(Effect.as(Effect.sleep(Duration.seconds(2)), true))
        : Stream.succeed(false),
    ),
    Stream.changes,
  );
