import { TelemetryOutbox } from "@stu/observability/browser";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

export class TelemetryLifecycle extends Context.Service<
  TelemetryLifecycle,
  {
    readonly isActive: Effect.Effect<boolean>;
    readonly whenActive: Effect.Effect<void>;
  }
>()("@stu/mobile/infra/observability/controller/TelemetryLifecycle") {}

export class TelemetryConnectivity extends Context.Service<
  TelemetryConnectivity,
  {
    readonly isOnline: Effect.Effect<boolean>;
    readonly whenOnline: Effect.Effect<void>;
  }
>()("@stu/mobile/infra/observability/controller/TelemetryConnectivity") {}

/** Flushes on foregrounding, restored connectivity, and a bounded periodic fallback. */
export const runTelemetryController = Effect.fn("MobileTelemetry.controller")(function* (
  flushInterval = Duration.seconds(30),
) {
  const outbox = yield* TelemetryOutbox;
  const lifecycle = yield* TelemetryLifecycle;
  const connectivity = yield* TelemetryConnectivity;
  const flush = Effect.gen(function* () {
    if (!(yield* lifecycle.isActive)) return;
    const online = yield* connectivity.isOnline;
    yield* outbox
      .flush({ online })
      .pipe(
        Effect.catchTag("TelemetryStorageError", (error) =>
          Effect.logWarning("Mobile telemetry queue unavailable").pipe(
            Effect.annotateLogs({ operation: error.operation }),
          ),
        ),
      );
  });
  const awaitTrigger = Effect.raceAll([
    lifecycle.whenActive,
    connectivity.whenOnline,
    Effect.sleep(flushInterval),
  ]);

  yield* flush;
  return yield* awaitTrigger.pipe(Effect.andThen(flush), Effect.forever);
});
