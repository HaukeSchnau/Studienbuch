import { Data, Effect, Layer, Queue, ServiceMap, Stream } from "effect";
import rabbit, { type Offset } from "rabbitmq-stream-js-client";
import type { Message } from "rabbitmq-stream-js-client/dist/publisher";

export class RabbitMqError extends Data.TaggedError("RabbitMqError")<{
  cause: unknown;
  reason:
    | "CONNECTION_FAILED"
    | "DECLARE_PUBLISHER_FAILED"
    | "PUBLISH_FAILED"
    | "DECLARE_CONSUMER_FAILED"
    | "CONSUMER_ERROR"
    | "DECLARE_STREAM_FAILED";
}> {
  get message() {
    return this.cause instanceof Error ? this.cause.message : String(this.cause);
  }

  toString() {
    return `RabbitMqError[${this.reason}]: ${this.message}`;
  }
}

interface RabbitMQClientService {
  readonly publish: (stream: string, message: Buffer) => Effect.Effect<void, RabbitMqError>;
  readonly subscribe: (stream: string, offset: Offset) => Stream.Stream<Message, RabbitMqError>;
}

export class RabbitMQClient extends ServiceMap.Service<RabbitMQClient, RabbitMQClientService>()("RabbitMQClient") {}

export const RabbitMQClientLive = Layer.effect(
  RabbitMQClient,
  Effect.gen(function* () {
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          rabbit.connect({
            hostname: "localhost",
            port: 5552,
            username: "guest",
            password: "guest",
            vhost: "/",
            addressResolver: { enabled: true },
          }),
        catch: (error) => new RabbitMqError({ cause: error, reason: "CONNECTION_FAILED" }),
      }),
      (client) => {
        return Effect.promise(() => client.close());
      },
    );

    const streamSizeRetention = 5 * 1e9;
    const createStream = (stream: string) =>
      Effect.tryPromise({
        try: () => client.createStream({ stream, arguments: { "max-length-bytes": streamSizeRetention } }),
        catch: (error) => new RabbitMqError({ cause: error, reason: "DECLARE_STREAM_FAILED" }),
      });

    const createProducer = Effect.fn(function* (stream: string) {
      yield* createStream(stream);
      return yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            client.declarePublisher({
              stream,
            }),
          catch: (error) => new RabbitMqError({ cause: error, reason: "DECLARE_PUBLISHER_FAILED" }),
        }),
        (publisher) => Effect.promise(() => publisher.close()),
      );
    });

    const publish = Effect.fn(function* (stream: string, message: Buffer) {
      const producer = yield* createProducer(stream);
      yield* Effect.tryPromise({
        try: () => producer.send(message),
        catch: (error) => new RabbitMqError({ cause: error, reason: "PUBLISH_FAILED" }),
      });
    }, Effect.scoped);

    const createConsumer = Effect.fn(function* (stream: string, offset: Offset, callback: (message: Message) => void) {
      yield* createStream(stream);
      return yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            client.declareConsumer(
              {
                stream,
                offset,
              },
              callback,
            ),
          catch: (error) => new RabbitMqError({ cause: error, reason: "DECLARE_CONSUMER_FAILED" }),
        }),
        (consumer) => Effect.promise(() => consumer.close()),
      );
    });

    const subscribe = (stream: string, offset: Offset) =>
      Stream.callback<Message, RabbitMqError>((queue) =>
        createConsumer(stream, offset, (message) => {
          Queue.offerUnsafe(queue, message);
        }).pipe(Effect.asVoid),
      );

    return RabbitMQClient.of({
      publish,
      subscribe,
    });
  }),
);
