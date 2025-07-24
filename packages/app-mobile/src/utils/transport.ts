import type { Transport } from "@groundswell/core";
import { DuplicateEventError, TransportError } from "@groundswell/core";
import { type Context, Effect, Layer, Stream } from "effect";
import superjson from "superjson";
import type z from "zod";

// Define the configuration for creating the transport layer.
export interface HonoTransportConfig<TEvent> {
  /** The base URL of the server API. */
  baseUrl: string;
  /** The Zod schema for parsing incoming events. */
  eventSchema: z.Schema<TEvent>;
  /** Optional headers to be sent with every request (e.g., for authorization). */
  headers?: Record<string, string>;
}

/**
 * Creates a Layer that provides a live implementation of the Transport service
 * using HTTP requests for publishing and Server-Sent Events (SSE) for listening.
 *
 * @param config The configuration object.
 * @returns A Layer that provides the Transport service.
 */
export const createSseTransportLayer = <TEvent extends { id: string }, TagId>(
  TransportTag: Context.Tag<TagId, Transport<TEvent>>,
  config: HonoTransportConfig<TEvent>,
) =>
  Layer.effect(
    TransportTag,
    Effect.gen(function* () {
      return TransportTag.of({
        publish: (event) =>
          Effect.gen(function* () {
            yield* Effect.log("publishing", event);

            yield* Effect.tryPromise({
              try: () =>
                fetch(`${config.baseUrl}/events`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...config.headers,
                  },
                  body: superjson.stringify(event),
                }),
              catch: (cause) => new TransportError({ cause, isRetryable: true }),
            }).pipe(
              Effect.flatMap((response) =>
                Effect.gen(function* () {
                  if (response.ok) {
                    return yield* Effect.succeed(undefined);
                  }

                  if (response.status === 409) {
                    return yield* Effect.fail(
                      new DuplicateEventError({
                        eventId: event.id,
                      }),
                    );
                  }

                  // 4xx errors are client errors and not retryable.
                  // 5xx errors are server errors and are retryable.
                  const isRetryable = response.status >= 500;
                  return yield* Effect.fail(
                    new TransportError({
                      cause: `Request failed with status ${response.status}`,
                      isRetryable,
                    }),
                  );
                }),
              ),
              Effect.tapError((error) => Effect.logError(error)),
            );
          }),

        listen: Effect.gen(function* () {
          yield* Effect.log("stub");
          return Stream.empty;
        }),
      });
    }),
  );
