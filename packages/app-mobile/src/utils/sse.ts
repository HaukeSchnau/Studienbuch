import { EventSourceError, EventSourceService } from "@groundswell/adapter-sse-client/event-source";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import EventSource from "react-native-sse";

/**
 * Live Layer for EventSourceService using the React Native EventSource API.
 */
export const ReactNativeEventSourceServiceLive = Layer.succeed(
  EventSourceService,
  EventSourceService.of({
    connect: (url, options) =>
      Stream.asyncEffect((emit) =>
        Effect.gen(function* () {
          console.error("hello");
          console.error(url);
          console.error(options?.headers());
          const es = new EventSource(url, {
            headers: options?.headers(),
          });
          console.error("hello2");

          es.addEventListener("open", () => {
            // Connection opened, no data to emit for this event
          });

          es.addEventListener("message", (event) => {
            console.error(event);
            emit.single({
              data: event.data ?? "",
              id: Option.fromNullable(event.lastEventId),
              event: Option.fromNullable(event.type),
              retry: Option.none(), // Native EventSource doesn't expose this directly
            });
          });

          es.addEventListener("error", (errorEvent) => {
            // Emit an error, which will terminate the stream
            emit.fail(
              new EventSourceError({
                reason: "NetworkError",
                originalError: errorEvent,
              }),
            );
          });

          return Stream.finalizer(Effect.sync(() => es.close()));
        }),
      ),
  }),
);
