export interface TelemetryIngressPolicy {
  readonly check: (request: Request) => { readonly allowed: true } | TelemetryPolicyRejection;
}

export interface TelemetryPolicyRejection {
  readonly allowed: false;
  readonly status: 403 | 429;
  readonly error: "same_origin_required" | "rate_limited";
  readonly retryAfterSeconds?: number;
}

export function makeTelemetryIngressPolicy(options?: {
  readonly limit?: number;
  readonly windowMillis?: number;
  readonly now?: () => number;
}): TelemetryIngressPolicy {
  const limit = options?.limit ?? 60;
  const windowMillis = options?.windowMillis ?? 60_000;
  const now = options?.now ?? Date.now;
  let windowStartedAt = now();
  let accepted = 0;

  return {
    check(request) {
      const origin = request.headers.get("origin");
      if (origin === null || origin !== new URL(request.url).origin) {
        return { allowed: false, status: 403, error: "same_origin_required" };
      }

      const currentTime = now();
      if (currentTime - windowStartedAt >= windowMillis) {
        windowStartedAt = currentTime;
        accepted = 0;
      }
      if (accepted >= limit) {
        return {
          allowed: false,
          status: 429,
          error: "rate_limited",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((windowStartedAt + windowMillis - currentTime) / 1_000),
          ),
        };
      }
      accepted += 1;
      return { allowed: true };
    },
  };
}

export const telemetryIngressPolicy = makeTelemetryIngressPolicy();
