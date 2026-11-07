/**
 * The `Access` RPC group: redeeming a code before sign-up, behind two limits on failures. A code
 * has 80 random bits, so no rate makes guessing one worthwhile, and a class behind its school's
 * one address may mistype its codes freely up to the client ceiling. A code that keeps failing,
 * from any address, waits. Right codes never count, so nobody can block one by redeeming it.
 */
import { Access } from "@stu/api/Access";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Headers from "effect/http/Headers";
import * as Option from "effect/Option";
import { Limits } from "../limits/Limits.ts";
import { AccessCodes } from "./AccessCodes.ts";

export * as Redemption from "./Redemption.ts";

/** Failed redeems of one code per window. */
export const failuresPerCode = 20;

export const handlers = Access.Rpcs.toLayer(
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const counts = Limits.make(Limits.clientWindow);

    // The key of a code, never the code: these counts sit in memory for a window.
    const codeKey = (code: string) =>
      Effect.map(
        Effect.orDie(crypto.digest("SHA-256", new TextEncoder().encode(Access.canonical(code)))),
        (digest) => `code ${Hex.encode(digest)}`,
      );

    return Access.Rpcs.of({
      "Access.redeem": Effect.fn("Redemption.redeem")(function* ({ code }, { headers }) {
        const now = yield* Clock.currentTimeMillis;
        const forwardedFor = Option.getOrNull(Headers.get(headers, "x-forwarded-for"));
        const address = `address ${Limits.client(forwardedFor)}`;
        const key = yield* codeKey(code);

        const wait = Option.orElse(counts.blocked(address, Limits.perClient, now), () =>
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
