/**
 * Single-use tickets that open one sync connection each. A device posts its bearer token for one
 * right before it connects, because a browser can't set headers on a WebSocket upgrade, and the
 * ticket in the URL is spent by the time a proxy logs it. They live in memory for 30 seconds.
 */
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { Ports } from "./Ports.ts";
import { Revocations } from "./Revocations.ts";

export * as Tickets from "./Tickets.ts";

/** How long a ticket stays valid after its issue. */
export const lifetime = Duration.seconds(30);

/** Open tickets per session at most. A new one replaces the oldest. */
export const perSession = 8;

/** What a ticket opens: the session, and the request headers that resolved it, to check again. */
export interface Admission {
  readonly session: Ports.ResolvedSession;
  readonly headers: Headers.Headers;
}

export class Service extends Context.Service<
  Service,
  {
    /** A new ticket for the session that `headers` resolved to. */
    readonly issue: (admission: Admission) => Effect.Effect<string>;
    /** The ticket's admission, once, within its lifetime, unless its session was revoked since. */
    readonly redeem: (ticket: string) => Effect.Effect<Option.Option<Admission>>;
  }
>()("@stu/sync/server/Tickets") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const revocations = yield* Revocations.Service;

    // Only `issue` adds tickets, so the lookup never runs. Insertion order is issue order, which
    // the per-session cap relies on, and `issue` reads every entry, which drops the expired ones.
    const open = yield* Cache.make({
      lookup: (_ticket: string): Effect.Effect<Admission> =>
        Effect.die("A ticket comes from issue"),
      capacity: Number.POSITIVE_INFINITY,
      timeToLive: lifetime,
    });

    const issue = Effect.fn("Tickets.issue")(function* (admission: Admission) {
      const { sessionId } = admission.session;

      const held = Array.from(yield* Cache.entries(open)).filter(
        ([, each]) => each.session.sessionId === sessionId,
      );

      yield* Effect.forEach(
        held.slice(0, Math.max(0, held.length - perSession + 1)),
        ([ticket]) => Cache.invalidate(open, ticket),
        { discard: true },
      );

      const ticket = Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));
      yield* Cache.set(open, ticket, admission);

      return ticket;
    });

    const redeem = Effect.fn("Tickets.redeem")(function* (ticket: string) {
      const held = yield* Cache.getSuccess(open, ticket);
      // Two redeems can both read the ticket before either removes it. Only one removes it.
      const spent = yield* Cache.invalidateWhen(open, ticket, () => true);

      if (Option.isNone(held) || !spent) return Option.none();

      if (yield* revocations.revoked(held.value.session.sessionId)) return Option.none();

      return held;
    });

    return Service.of({ issue, redeem });
  }),
);
