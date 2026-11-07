/**
 * The `Access` RPC group: redeeming a code before sign-up, behind two limits on failures. An
 * address gets a few wrong codes per window, so guessing is slow from anywhere, while a class
 * behind one school address can still enter its codes together. A code that keeps failing, from
 * any address, waits too. Right codes never count, so nobody can block one by redeeming it.
 */
import { Access } from "@stu/api/Access";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Headers from "effect/http/Headers";
import * as Option from "effect/Option";
import { AccessCodes } from "./AccessCodes.ts";

export * as Redemption from "./Redemption.ts";

const window = 15 * 60 * 1000;

/** Wrong codes per address and window. */
export const failuresPerAddress = 10;

/** Failed redeems of one code per window. */
export const failuresPerCode = 20;

/**
 * The client's address, which the host's proxy puts in `X-Forwarded-For` (hosting.md, the host
 * contract). Of a chain, the last entry is the one the proxy added.
 */
const addressOf = (headers: Headers.Headers) =>
  Option.match(Headers.get(headers, "x-forwarded-for"), {
    onNone: () => "unknown",
    onSome: (value) => value.split(",").at(-1)?.trim() ?? "unknown",
  });

interface Count {
  readonly count: number;
  readonly resetAt: number;
}

/** Counts per key within fixed windows. */
const counter = () => {
  const counts = new Map<string, Count>();

  const current = (key: string, now: number) => {
    const found = counts.get(key);

    return found === undefined || found.resetAt <= now
      ? { count: 0, resetAt: now + window }
      : found;
  };

  return {
    /** Seconds until the key may count again, or none while it is under `limit`. */
    blocked: (key: string, limit: number, now: number) => {
      const found = current(key, now);

      return found.count >= limit
        ? Option.some(Math.ceil((found.resetAt - now) / 1000))
        : Option.none<number>();
    },
    add: (key: string, now: number) => {
      const found = current(key, now);
      counts.set(key, { count: found.count + 1, resetAt: found.resetAt });

      // Old windows go, so the map holds only keys of the last window.
      if (counts.size > 10_000) {
        for (const [each, value] of counts) if (value.resetAt <= now) counts.delete(each);
      }
    },
  };
};

export const handlers = Access.Rpcs.toLayer(
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const counts = counter();

    // The key of a code, never the code: these counts sit in memory for a window.
    const codeKey = (code: string) =>
      Effect.map(
        Effect.orDie(crypto.digest("SHA-256", new TextEncoder().encode(Access.canonical(code)))),
        (digest) => `code ${Hex.encode(digest)}`,
      );

    return Access.Rpcs.of({
      "Access.redeem": Effect.fn("Redemption.redeem")(function* ({ code }, { headers }) {
        const now = yield* Clock.currentTimeMillis;
        const address = `address ${addressOf(headers)}`;
        const key = yield* codeKey(code);

        const wait = Option.orElse(counts.blocked(address, failuresPerAddress, now), () =>
          counts.blocked(key, failuresPerCode, now),
        );

        if (Option.isSome(wait)) {
          return yield* new Access.RateLimited({ retryAfterSeconds: wait.value });
        }

        const reserved = yield* AccessCodes.reserve(code).pipe(
          Effect.tapErrorTag("Access.CodeUnavailable", () =>
            Effect.sync(() => {
              counts.add(address, now);
              counts.add(key, now);
            }),
          ),
          // The database failing is the server's fault, not the caller's.
          Effect.catchTags({ SqlError: Effect.die }),
        );

        return new Access.Reservation(reserved);
      }),
    });
  }),
);
