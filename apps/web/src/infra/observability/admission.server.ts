import { getAuth } from "#/infra/auth/better-auth.ts";
import {
  forwardedClientPrincipal,
  makeFixedWindowLimiter,
  type RateLimitRejection,
} from "#/infra/http/rate-limit.server.ts";

export interface TelemetryAdmission {
  readonly check: (request: Request) => Promise<AdmissionDecision>;
}

export type AdmissionDecision =
  | { readonly allowed: true; readonly principal: string }
  | AdmissionRejection;

export type AdmissionRejection =
  | RateLimitRejection
  | { readonly allowed: false; readonly status: 403; readonly error: "admission_denied" };

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
  if (origin === null) return undefined;

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  const protocol = forwardedProtocol ?? requestUrl.protocol.slice(0, -1);
  if (protocol !== "http" && protocol !== "https") return undefined;

  let publicOrigin: string;
  try {
    publicOrigin = new URL(`${protocol}://${host}`).origin;
  } catch {
    return undefined;
  }
  if (origin !== publicOrigin) return undefined;
  // Browsers on one origin are indistinguishable to us without a session, so they share a bucket
  // keyed by the forwarded client address where a proxy supplies one.
  return `origin:${origin}:${forwardedClientPrincipal(request)}`;
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
