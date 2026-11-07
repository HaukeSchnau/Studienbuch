/**
 * Counts of attempts, kept in this process, behind the limits on guessing and flooding. A school's
 * whole network reaches us from one address, so a limit per client address is only a ceiling, and
 * the limits that stop guessing count per code, per email address or per access code.
 */
import * as Duration from "effect/Duration";
import * as Option from "effect/Option";

export * as Limits from "./Limits.ts";

/** Requests per client address and route in `clientWindow`: two classes signing up at once. */
export const perClient = 100;

export const clientWindow = "15 minutes";

/**
 * The client's address, which the host's proxy puts in `X-Forwarded-For` (hosting.md, the host
 * contract). Of a chain, the last entry is the one the proxy added.
 */
export const client = (forwardedFor: string | null | undefined) => {
  const last = forwardedFor?.split(",").at(-1)?.trim() ?? "";

  return last === "" ? "unknown" : last;
};

interface Count {
  readonly count: number;
  readonly resetAt: number;
}

/** Counts per key in fixed windows, each starting at the key's first count. */
export const make = (window: Duration.Input) => {
  const length = Duration.toMillis(window);
  const counts = new Map<string, Count>();

  const current = (key: string, now: number) => {
    const found = counts.get(key);

    return found === undefined || found.resetAt <= now
      ? { count: 0, resetAt: now + length }
      : found;
  };

  /** Seconds until `key` may count again, or none while it is under `limit`. */
  const blocked = (key: string, limit: number, now: number) => {
    const found = current(key, now);

    return found.count >= limit
      ? Option.some(Math.ceil((found.resetAt - now) / 1000))
      : Option.none<number>();
  };

  const add = (key: string, now: number) => {
    const found = current(key, now);
    counts.set(key, { count: found.count + 1, resetAt: found.resetAt });

    // Old windows go, so the map holds only keys of the last window.
    if (counts.size > 10_000) {
      for (const [each, value] of counts) if (value.resetAt <= now) counts.delete(each);
    }
  };

  return {
    blocked,
    add,
    /** Counts `key` unless it reached `limit`. None when it counted, or the seconds to wait. */
    take: (key: string, limit: number, now: number) => {
      const wait = blocked(key, limit, now);

      if (Option.isNone(wait)) add(key, now);

      return wait;
    },
  };
};
