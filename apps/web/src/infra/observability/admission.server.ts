import { getAuth } from "#/infra/auth/better-auth.ts";

export interface TelemetryAdmission {
  readonly check: (request: Request) => Promise<AdmissionDecision>;
}

export type AdmissionDecision =
  | { readonly allowed: true; readonly principal: string }
  | AdmissionRejection;

export interface AdmissionRejection {
  readonly allowed: false;
  readonly status: 403 | 429;
  readonly error: "admission_denied" | "rate_limited";
  readonly retryAfterSeconds?: number;
}

/**
 * Who may post client telemetry.
 *
 * Two kinds of client reach this route and they cannot authenticate the same way. A browser sends
 * an `Origin` header the server can compare against its own; a native app sends none at all, which
 * is why the previous origin-only check rejected every mobile envelope with `403`. Native clients
 * instead present their session, which also gives a far better rate-limiting principal than an
 * origin shared by every visitor.
 */
export type AdmissionAuthority = (request: Request) => Promise<string | undefined>;

/** Resolves the Better Auth session behind a request, if it carries one. */
export const sessionAuthority: AdmissionAuthority = async (request) => {
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  return session?.user.id;
};

function sameOriginPrincipal(request: Request): string | undefined {
  const origin = request.headers.get("origin");
  if (origin === null || origin !== new URL(request.url).origin) return undefined;
  // Browsers on one origin are indistinguishable to us without a session, so they share a bucket
  // keyed by the forwarded client address where a proxy supplies one.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return `origin:${origin}:${forwarded ?? "unknown"}`;
}

/**
 * A fixed-window limiter keyed per principal, holding at most `maxPrincipals` buckets.
 *
 * The window lives in process memory, so N instances permit N times the configured rate. That is
 * accepted here: the real bounds on this route are the 64 KiB body cap and the allowlisted record
 * schema, and this limiter exists to stop one client from monopolising ingestion — which the
 * previous single global window could not do, since one noisy client starved every other.
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

  return (principal: string): { readonly allowed: true } | AdmissionRejection => {
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

export function makeTelemetryAdmission(options?: {
  readonly authority?: AdmissionAuthority;
  readonly limit?: number;
  readonly windowMillis?: number;
  readonly now?: () => number;
}): TelemetryAdmission {
  const authority = options?.authority ?? sessionAuthority;
  const limiter = makeFixedWindowLimiter({
    limit: options?.limit,
    windowMillis: options?.windowMillis,
    now: options?.now,
  });

  return {
    check: async (request) => {
      // Same-origin is checked first so ordinary browser traffic never costs a session lookup.
      let principal = sameOriginPrincipal(request);
      if (principal === undefined) {
        const userId = await authority(request).catch(() => undefined);
        principal = userId === undefined ? undefined : `user:${userId}`;
      }
      if (principal === undefined) {
        return { allowed: false, status: 403, error: "admission_denied" };
      }

      const decision = limiter(principal);
      return decision.allowed ? { allowed: true, principal } : decision;
    },
  };
}

export const telemetryAdmission = makeTelemetryAdmission();
