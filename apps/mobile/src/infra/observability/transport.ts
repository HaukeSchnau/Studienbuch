import { makeTelemetryHttpDelivery, TelemetryDelivery } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

export type TelemetrySessionCookie = () => Promise<string | undefined>;

export interface FetchTelemetryTransportOptions {
  readonly endpoint: string;
  readonly sessionCookie: TelemetrySessionCookie;
  readonly fetch?: typeof globalThis.fetch;
}

/** Native Effect HTTP delivery with a fresh Better Auth session header for every attempt. */
export const telemetryTransportLayer = (
  options: FetchTelemetryTransportOptions,
): Layer.Layer<TelemetryDelivery> => {
  const fetchLayer =
    options.fetch === undefined
      ? FetchHttpClient.layer
      : FetchHttpClient.layer.pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, options.fetch)),
        );
  return Layer.effect(
    TelemetryDelivery,
    makeTelemetryHttpDelivery({
      endpoint: options.endpoint,
      sessionCookie: Effect.tryPromise({
        try: () => options.sessionCookie(),
        catch: () => undefined,
      }).pipe(Effect.catchCause(() => Effect.as(Effect.void, undefined))),
    }),
  ).pipe(Layer.provide(fetchLayer));
};
