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
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { Ports } from "./Ports.ts";

export * as Tickets from "./Tickets.ts";

/** How long a ticket stays valid after its issue. */
export const lifetime = Duration.seconds(30);

export class Service extends Context.Service<
  Service,
  {
    /** A new ticket for the session. */
    readonly issue: (session: Ports.ResolvedSession) => Effect.Effect<string>;
    /** The ticket's session, once, within its lifetime. */
    readonly redeem: (ticket: string) => Effect.Effect<Option.Option<Ports.ResolvedSession>>;
  }
>()("@stu/sync/server/Tickets") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;

    const open = new Map<
      string,
      { readonly session: Ports.ResolvedSession; readonly until: number }
    >();

    const issue = Effect.fn("Tickets.issue")(function* (session: Ports.ResolvedSession) {
      const now = yield* Clock.currentTimeMillis;

      for (const [ticket, { until }] of open) if (until <= now) open.delete(ticket);

      const ticket = Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));
      open.set(ticket, { session, until: now + Duration.toMillis(lifetime) });

      return ticket;
    });

    const redeem = Effect.fn("Tickets.redeem")(function* (ticket: string) {
      const now = yield* Clock.currentTimeMillis;
      const held = open.get(ticket);
      open.delete(ticket);

      return held !== undefined && held.until > now ? Option.some(held.session) : Option.none();
    });

    return Service.of({ issue, redeem });
  }),
);
