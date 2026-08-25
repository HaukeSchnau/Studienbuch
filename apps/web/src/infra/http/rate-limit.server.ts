import { jsonResponse } from "#/infra/http/response.server.ts";

/** What a limiter says when a principal has spent its window. */
export interface RateLimitRejection {
  readonly allowed: false;
  readonly status: 429;
  readonly error: "rate_limited";
  readonly retryAfterSeconds: number;
}

export type RateLimitDecision = { readonly allowed: true } | RateLimitRejection;

/**
 * A fixed-window limiter keyed per principal, holding at most `maxPrincipals` windows.
 *
 * The windows live in process memory, so N instances permit N times the configured rate. That is
 * accepted: this exists to stop one client from monopolising a route, not to enforce a global
 * quota, and a limiter one instance can answer from memory costs nothing per request.
 *
 * TODO: move the windows into shared storage once the web application runs as more than one
 * instance, or the configured rate stops meaning what it says.
 */
export function makeFixedWindowLimiter(options?: {
  readonly limit?: number;
  readonly windowMillis?: number;
  readonly maxPrincipals?: number;
  readonly now?: () => number;
}) {
  const limit = options?.limit ?? 60;
  const windowMillis = options?.windowMillis ?? 60_000;
  const maxPrincipals = options?.maxPrincipals ?? 10_000;
  const now = options?.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; accepted: number }>();

  return (principal: string): RateLimitDecision => {
    const currentTime = now();
    if (windows.size > maxPrincipals) {
      for (const [key, window] of windows) {
        if (currentTime - window.startedAt >= windowMillis) windows.delete(key);
      }
      // Still full of live windows: shed the oldest rather than growing without bound.
      if (windows.size > maxPrincipals) {
        const oldest = windows.keys().next();
        if (!oldest.done) windows.delete(oldest.value);
      }
    }

    const window = windows.get(principal);
    if (window === undefined || currentTime - window.startedAt >= windowMillis) {
      windows.set(principal, { startedAt: currentTime, accepted: 1 });
      return { allowed: true };
    }
    if (window.accepted >= limit) {
      return {
        allowed: false,
        status: 429,
        error: "rate_limited",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((window.startedAt + windowMillis - currentTime) / 1_000),
        ),
      };
    }
    window.accepted += 1;
    return { allowed: true };
  };
}

/**
 * Who a request is limited as, when it has no session to be limited by.
 *
 * A proxy's forwarded address is the closest thing to one client this application can see. It is
 * spoofable by anything talking to the origin directly, which is why it is only ever a limiting
 * key and never an authorisation one.
 */
export const forwardedClientPrincipal = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";

/** The rejection as a client sees it, including when it is worth trying again. */
export const rateLimitedResponse = (rejection: RateLimitRejection) => {
  const response = jsonResponse({ error: rejection.error }, rejection.status);
  response.headers.set("retry-after", String(rejection.retryAfterSeconds));
  return response;
};
