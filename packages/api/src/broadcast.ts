import { BroadcastError } from "@groundswell/core-server";
import type { DomainEvent } from "@stu/lib";
import { Effect, Layer, PubSub, Stream } from "effect";
import { Offset } from "rabbitmq-stream-js-client";
import superjson from "superjson";
import { DomainBroadcast, DomainCanonicalStorage } from "./boilerplate";
import { RabbitMQClient } from "./rabbitmq";

export const memoryBroadcastLive = Layer.effect(
  DomainBroadcast,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<{ userId: string; event: DomainEvent }>();
    const canonicalStorage = yield* DomainCanonicalStorage;

    const markEventAsSentToUser = (eventId: string, userId: string) =>
      canonicalStorage.markEventAsSentToUser(eventId, userId).pipe(
        Effect.as(true),
        Effect.catchTag("CanonicalStorageError", (error) => {
          if (
            typeof error.cause === "object" &&
            error.cause !== null &&
            "type" in error.cause &&
            error.cause.type === "unique_violation"
          ) {
            // Event was already marked as sent for this user. We skip re-publishing.
            return Effect.succeed(false);
          }
          return Effect.fail(new BroadcastError({ cause: error }));
        }),
      );

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
          yield* pubsub.publishAll(publishable.map((event) => ({ userId, event })));
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
    const client = yield* RabbitMQClient;
    const canonicalStorage = yield* DomainCanonicalStorage;

    const markEventAsSentToUser = (eventId: string, userId: string) =>
      canonicalStorage.markEventAsSentToUser(eventId, userId).pipe(
        Effect.as(true),
        Effect.catchTag("CanonicalStorageError", (error) => {
          if (
            typeof error.cause === "object" &&
            error.cause !== null &&
            "type" in error.cause &&
            error.cause.type === "unique_violation"
          ) {
            return Effect.succeed(false);
          }
          return Effect.fail(new BroadcastError({ cause: error }));
        }),
      );

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
          Stream.catchTag("RabbitMqError", (error) => Effect.fail(new BroadcastError({ cause: error }))),
        );
      },
    });
  }),
);
