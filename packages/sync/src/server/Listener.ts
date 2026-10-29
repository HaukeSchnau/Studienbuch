/**
 * Postgres's `LISTEN`, which the server's pokes travel on. `@effect/sql-pg`'s `PgClient` and
 * `@effect/sql-pglite`'s `PgliteClient` both listen, under different service tags, so the
 * server takes either through this one service.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Queue from "effect/Queue";
import type * as Scope from "effect/Scope";
import type * as SqlError from "effect/sql/SqlError";
import * as Stream from "effect/Stream";

export * as Listener from "./Listener.ts";

export class Service extends Context.Service<
  Service,
  {
    /** The payloads sent on `channel` from when `LISTEN` holds until the scope closes. */
    readonly listen: (
      channel: string,
    ) => Effect.Effect<Stream.Stream<string, SqlError.SqlError>, SqlError.SqlError, Scope.Scope>;
  }
>()("@stu/sync/server/Listener") {}

/** A client that listens, such as `PgClient` or `PgliteClient`. */
export interface Client<A, E> {
  readonly listen: (
    channel: string,
  ) => Effect.Effect<Queue.Dequeue<A, E>, SqlError.SqlError, Scope.Scope>;
}

/** `LISTEN` through `client`, whose notifications carry their text as `payload` says. */
export const make = <A, E extends SqlError.SqlError>(
  client: Client<A, E>,
  payload: (notification: A) => string,
) =>
  Service.of({
    listen: (channel) =>
      Effect.map(client.listen(channel), (queue) => Stream.map(Stream.fromQueue(queue), payload)),
  });

/**
 * `LISTEN` through a client service, as in
 * `Listener.layer(PgClient.PgClient, (notification) => notification.payload)`.
 */
export const layer = <A, E extends SqlError.SqlError, EL, R>(
  client: Effect.Effect<Client<A, E>, EL, R>,
  payload: (notification: A) => string,
) =>
  Layer.effect(
    Service,
    Effect.map(client, (listening) => make(listening, payload)),
  );
