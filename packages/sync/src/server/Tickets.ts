/**
 * Single-use tickets that open one sync connection each. A device posts its bearer token for one
 * right before it connects, because a browser can't set headers on a WebSocket upgrade, and the
 * ticket in the URL is spent by the time a proxy logs it. They live in memory for 30 seconds.
 */
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
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
    // Insertion order is issue order, which the per-session cap and the sweep rely on.
    const open = new Map<string, { readonly admission: Admission; readonly until: number }>();

    const sweep = Effect.map(Clock.currentTimeMillis, (now) => {
      for (const [ticket, { until }] of open) if (until <= now) open.delete(ticket);
    });

    yield* sweep.pipe(Effect.repeat(Schedule.spaced(lifetime)), Effect.forkScoped);

    const issue = Effect.fn("Tickets.issue")(function* (admission: Admission) {
      const now = yield* Clock.currentTimeMillis;
      const { sessionId } = admission.session;

      const held = [...open].filter(
        ([, { admission }]) => admission.session.sessionId === sessionId,
      );

      for (const [ticket] of held.slice(0, Math.max(0, held.length - perSession + 1))) {
        open.delete(ticket);
      }

      const ticket = Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));
      open.set(ticket, { admission, until: now + Duration.toMillis(lifetime) });

      return ticket;
    });

    const redeem = Effect.fn("Tickets.redeem")(function* (ticket: string) {
      const now = yield* Clock.currentTimeMillis;
      const held = open.get(ticket);
      open.delete(ticket);

      if (held === undefined || held.until <= now) return Option.none();

      if (yield* revocations.revoked(held.admission.session.sessionId)) return Option.none();

      return Option.some(held.admission);
    });

    return Service.of({ issue, redeem });
  }),
);
