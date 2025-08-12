import { BroadcastError } from "@groundswell/core-server";
import type { DomainEvent } from "@stu/lib";
import { Effect, Layer, PubSub, Stream } from "effect";
import { Offset } from "rabbitmq-stream-js-client";
import superjson from "superjson";
import { DomainBroadcast, DomainCanonicalStorage, DomainServerApplicator } from "./boilerplate";
import { runtime } from "./groundswell";
import { RabbitMQClient } from "./rabbitmq";

export const memoryBroadcastLive = Layer.effect(
  DomainBroadcast,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<DomainEvent>();
    const canonicalStorage = yield* DomainCanonicalStorage;

    return DomainBroadcast.of({
      publishToUser: Effect.fn(function* (userId, events) {
        yield* Effect.all(
          events.map((event) => canonicalStorage.markEventAsSentToUser(event.id, userId)),
          {
            concurrency: "unbounded",
          },
        ).pipe(
          Effect.catchTags({
            CanonicalStorageError: (error) => Effect.fail(new BroadcastError({ cause: error })),
          }),
        );
        yield* pubsub.publishAll(events);
      }),
      subscribe: (userId) => {
        runtime.runPromise(
          Effect.gen(function* () {
            const serverApplicator = yield* DomainServerApplicator;
            const topics = yield* serverApplicator.getUserTopics(userId);
            yield* Effect.log(topics);
            const missingEvents = yield* canonicalStorage.getMissingEventsForUser(userId, topics).pipe(
              Effect.catchTag("CanonicalStorageError", (error) => {
                return Effect.fail(new BroadcastError({ cause: error }));
              }),
            );
            yield* Effect.log(missingEvents);
          }),
        );
        const initStream = Stream.fromIterableEffect(
          canonicalStorage.getEventsSentToUser(userId).pipe(
            Effect.catchTag("CanonicalStorageError", (error) => {
              return Effect.fail(new BroadcastError({ cause: error }));
            }),
          ),
        );
        const stream = Stream.concat(initStream, Stream.fromPubSub(pubsub)).pipe(
          Stream.tap((event) => Effect.log(event)),
        );
        return stream;
      },
    });
  }),
);

export const rabbitmqBroadcastLive = Layer.effect(
  DomainBroadcast,
  Effect.gen(function* () {
    const client = yield* RabbitMQClient;

    return DomainBroadcast.of({
      publishToUser: Effect.fn(
        function* (userId, events) {
          for (const event of events) {
            const message = Buffer.from(superjson.stringify(event));
            yield* client.publish(userId, message);
          }
        },
        Effect.catchTags({
          RabbitMqError: (error) => Effect.fail(new BroadcastError({ cause: error })),
        }),
      ),
      subscribe: (userId) =>
        client.subscribe(userId, Offset.first()).pipe(
          Stream.map((message) => superjson.parse(message.content.toString()) as DomainEvent), // TODO: parse here?
          Stream.catchTag("RabbitMqError", (error) => Effect.fail(new BroadcastError({ cause: error }))),
        ),
    });
  }),
);
