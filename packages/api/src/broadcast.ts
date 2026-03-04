import type { CanonicalStorage } from "@groundswell/core-server";
import { BroadcastError } from "@groundswell/core-server";
import { Effect, Layer, PubSub, ServiceMap, Stream } from "effect";
import { Offset } from "rabbitmq-stream-js-client";
import superjson from "superjson";
import { DomainBroadcast, DomainCanonicalStorage } from "./boilerplate";
import { RabbitMQClient } from "./rabbitmq";

type DomainBroadcastService = ServiceMap.Service.Shape<typeof DomainBroadcast>;
type DomainEvent = Parameters<DomainBroadcastService["publishToUser"]>[1][number];

const isCanonicalStorageCauseType = (error: { cause: unknown }, expectedType: string) =>
  typeof error.cause === "object" && error.cause !== null && "type" in error.cause && error.cause.type === expectedType;

const createMarkEventAsSentToUser =
  (canonicalStorage: CanonicalStorage<DomainEvent>, layerName: "memory" | "rabbitmq") =>
  (eventId: string, userId: string, attempt = 0): Effect.Effect<boolean, BroadcastError> =>
    canonicalStorage.markEventAsSentToUser(eventId, userId).pipe(
      Effect.as(true),
      Effect.catchTag("CanonicalStorageError", (error) => {
        if (isCanonicalStorageCauseType(error, "unique_violation")) {
          // Event was already marked as sent for this user. We skip re-publishing.
          return Effect.succeed(false);
        }
        if (isCanonicalStorageCauseType(error, "foreign_key_violation")) {
          if (attempt < 5) {
            return Effect.sleep("100 millis").pipe(
              Effect.flatMap(() =>
                createMarkEventAsSentToUser(canonicalStorage, layerName)(eventId, userId, attempt + 1),
              ),
            );
          }
          return Effect.logWarning(
            `[${layerName} broadcast] Skipping publish for event ${eventId} and user ${userId}: canonical event row not available after retries`,
          ).pipe(Effect.as(false));
        }
        return Effect.fail(new BroadcastError({ cause: error }));
      }),
    );

export const memoryBroadcastLive = Layer.effect(
  DomainBroadcast,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<{ userId: string; event: DomainEvent }>();
    const canonicalStorage = yield* Effect.service(DomainCanonicalStorage);

    const markEventAsSentToUser = createMarkEventAsSentToUser(canonicalStorage, "memory");

    return DomainBroadcast.of({
      publishToUser: Effect.fn(function* (userId, events) {
        const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()];
        const publishable: DomainEvent[] = [];
        for (const event of uniqueEvents) {
          if (yield* markEventAsSentToUser(event.id, userId)) {
            publishable.push(event);
          }
        }
        if (publishable.length > 0) {
          yield* PubSub.publishAll(
            pubsub,
            publishable.map((event) => ({ userId, event })),
          );
        }
      }),
      subscribe: (userId, options) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const sentEvents = yield* canonicalStorage
              .getEventsSentToUser(userId)
              .pipe(
                Effect.catchTag("CanonicalStorageError", (error) => Effect.fail(new BroadcastError({ cause: error }))),
              );
            const offset = Math.max(0, Math.floor(options?.offset ?? 0));
            const replay = sentEvents.slice(offset);
            const replayStream = Stream.fromIterable(replay);
            const liveStream = Stream.fromPubSub(pubsub).pipe(
              Stream.filter((message) => message.userId === userId),
              Stream.map((message) => message.event),
            );
            return Stream.concat(replayStream, liveStream);
          }),
        ),
    });
  }),
);

export const rabbitmqBroadcastLive = Layer.effect(
  DomainBroadcast,
  Effect.gen(function* () {
    const client = yield* Effect.service(RabbitMQClient);
    const canonicalStorage = yield* Effect.service(DomainCanonicalStorage);

    const markEventAsSentToUser = createMarkEventAsSentToUser(canonicalStorage, "rabbitmq");

    return DomainBroadcast.of({
      publishToUser: Effect.fn(
        function* (userId, events) {
          const uniqueEvents = [...new Map(events.map((event) => [event.id, event])).values()];
          for (const event of uniqueEvents) {
            const shouldPublish = yield* markEventAsSentToUser(event.id, userId);
            if (!shouldPublish) {
              continue;
            }
            const message = Buffer.from(superjson.stringify(event));
            yield* client.publish(userId, message);
          }
        },
        Effect.catchTags({
          RabbitMqError: (error) => Effect.fail(new BroadcastError({ cause: error })),
        }),
      ),
      subscribe: (userId, options) => {
        const offset = options?.offset !== undefined ? Offset.offset(BigInt(options.offset)) : Offset.first();
        return client.subscribe(userId, offset).pipe(
          Stream.map((message) => superjson.parse(message.content.toString()) as DomainEvent), // TODO: parse here?
          Stream.catchTag("RabbitMqError", (error) => Stream.fail(new BroadcastError({ cause: error }))),
        );
      },
    });
  }),
);
