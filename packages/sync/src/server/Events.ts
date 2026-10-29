/**
 * `Sync.events`: one `LISTEN` per process feeds an in-process `PubSub`, and each connection takes
 * the pokes of the spaces its account reads, coalesced over 50 ms (sync.md, section 4). A poke is
 * a hint: the device pulls.
 */
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Protocol } from "../protocol/Protocol.ts";
import { Contract } from "./Contract.ts";
import { Listener } from "./Listener.ts";
import { Pokes } from "./Pokes.ts";

export * as Events from "./Events.ts";

export class Service extends Context.Service<
  Service,
  {
    /**
     * The events of `account`'s spaces, as `Sync.events` sends them to a client with `contract`,
     * from the moment this returns until the scope closes.
     */
    readonly subscribe: (
      account: string,
      contract: Protocol.Contract,
    ) => Effect.Effect<Stream.Stream<Protocol.Event>, never, Scope.Scope>;
  }
>()("@stu/sync/server/Events") {}

/** Commits that land this close together reach a device as one poke. */
export const coalescing = Duration.millis(50);

const decodePayload = Schema.decodeEffect(Schema.fromJsonString(Pokes.Payload));

/** A notification, or word that notifications may have been missed while `LISTEN` reconnected. */
type Heard = Pokes.Payload | "missed";

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const listener = yield* Listener.Service;
    const sql = yield* SqlClient.SqlClient;
    const heard = yield* PubSub.unbounded<Heard>();
    const listening = yield* Deferred.make<void>();

    const listen = Effect.scoped(
      Effect.gen(function* () {
        const payloads = yield* listener.listen(Pokes.channel);
        yield* Deferred.succeed(listening, undefined);
        yield* PubSub.publish(heard, "missed");

        yield* Stream.runForEach(payloads, (text) =>
          decodePayload(text).pipe(
            Effect.flatMap((payload) => PubSub.publish(heard, payload)),
            Effect.catchTags({
              SchemaError: () => Effect.logWarning("A poke didn't decode"),
            }),
          ),
        );
      }),
    );

    yield* listen.pipe(
      Effect.tapError((error) => Effect.logWarning("LISTEN lost its connection", error)),
      Effect.retry(Schedule.spaced("1 second")),
      Effect.forever,
      Effect.forkScoped,
    );

    // A connection must not start before pokes can reach it.
    yield* Deferred.await(listening);

    const spacesOf = (account: string) =>
      sql<{ readonly space: string }>`
        select space_id as space from space_member where account_id = ${account}
      `.pipe(
        Effect.map((rows) => new Set(rows.map((row) => row.space))),
        Effect.orDie,
      );

    const subscribe = Effect.fn("Events.subscribe")(function* (
      account: string,
      contract: Protocol.Contract,
    ) {
      const subscription = yield* PubSub.subscribe(heard);
      let spaces = yield* spacesOf(account);

      /** What one notification means for this account. */
      const relevant = Effect.fnUntraced(function* (item: Heard) {
        const changed = item === "missed" || item.accounts.includes(account);

        if (changed) spaces = yield* spacesOf(account);

        const cursors =
          item === "missed" ? [] : item.spaces.filter(({ space }) => spaces.has(space));

        return { changed, cursors };
      });

      return Stream.fromSubscription(subscription).pipe(
        Stream.mapEffect(relevant),
        Stream.filter(({ changed, cursors }) => changed || cursors.length > 0),
        Stream.groupedWithin(Number.POSITIVE_INFINITY, coalescing),
        Stream.flatMap((group) => {
          const newest = new Map<string, number>();

          for (const { space, version } of group.flatMap(({ cursors }) => cursors)) {
            newest.set(space, Math.max(version, newest.get(space) ?? 0));
          }

          const spaces = [...newest]
            .sort(([left], [right]) => (left < right ? -1 : 1))
            .map(([space, version]) => ({ space, version }));

          const events: Array<Protocol.Event> = [
            ...(group.some(({ changed }) => changed) ? [Protocol.AccountChanged.make({})] : []),
            ...(spaces.length > 0 ? [Protocol.Poke.make({ spaces })] : []),
          ];

          // An event this client can't decode stays home. Its next pull catches up.
          return Stream.fromIterable(
            events.filter((event) => Contract.needed([event._tag]) <= contract.protocol),
          );
        }),
      );
    });

    return Service.of({ subscribe });
  }),
);
