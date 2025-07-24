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
    const pubsub = yield* PubSub.unbounded<DomainEvent>();
    const canonicalStorage = yield* DomainCanonicalStorage;

    return DomainBroadcast.of({
      publishToUser: (userId, event) => {
        console.log("publishing to user", userId, event);
        return pubsub.publishAll(event);
      },
      subscribe: (userId) => {
        const initStream = Stream.fromIterableEffect(
          canonicalStorage.getEventsSentToUser(userId).pipe(
            Effect.catchTag("CanonicalStorageError", (error) => {
              return Effect.fail(new BroadcastError({ cause: error }));
            }),
          ),
        );
        return Stream.concat(initStream, Stream.fromPubSub(pubsub));
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
