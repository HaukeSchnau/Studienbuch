import { Data, Duration, Effect, Schedule } from "effect";
import type { ExternalApiServiceHttpPolicy } from "./config";

type ExternalApiService = "holidays" | "untis";
type ExternalApiRequestOutcome = "retry" | "success" | "failure";

export interface ExternalApiRequestObservation {
  service: ExternalApiService;
  operation: string;
  outcome: ExternalApiRequestOutcome;
  attempts: number;
  durationMs?: number;
  delayMs?: number;
  error?: string;
}

type ExternalApiRequestObserver = (observation: ExternalApiRequestObservation) => void;

let requestObserver: ExternalApiRequestObserver | undefined;

export const setExternalApiRequestObserver = (observer: ExternalApiRequestObserver | undefined) => {
  requestObserver = observer;
};

export class ExternalApiRequestTimeoutError extends Data.TaggedError("ExternalApiRequestTimeoutError")<{
  service: ExternalApiService;
  operation: string;
  timeoutMs: number;
}> {}

interface ExternalApiResilienceOptions {
  service: ExternalApiService;
  operation: string;
  policy: ExternalApiServiceHttpPolicy;
}

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
};

const emitObservation = (observation: ExternalApiRequestObservation, enableConsoleLogs: boolean) => {
  requestObserver?.(observation);
  if (!enableConsoleLogs) return;

  if (observation.outcome === "retry") {
    console.warn(
      `[external-api:${observation.service}] ${observation.operation} retry #${observation.attempts} in ${observation.delayMs ?? 0}ms`,
    );
    return;
  }

  if (observation.outcome === "success") {
    console.info(
      `[external-api:${observation.service}] ${observation.operation} success after ${observation.attempts} attempt(s) in ${observation.durationMs ?? 0}ms`,
    );
    return;
  }

  console.error(
    `[external-api:${observation.service}] ${observation.operation} failed after ${observation.attempts} attempt(s) in ${observation.durationMs ?? 0}ms: ${observation.error ?? "unknown error"}`,
  );
};

export const withExternalApiResilience =
  (options: ExternalApiResilienceOptions) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) => {
    const startedAt = Date.now();
    let retries = 0;
    const consoleLogsEnabled = options.policy.observabilityEnabled;

    const schedule = Schedule.recurs(options.policy.retryAttempts).pipe(
      Schedule.addDelay(() => Duration.millis(options.policy.retryDelayMs)),
      Schedule.modifyDelayEffect((count, delay) =>
        Effect.sync(() => {
          retries = count + 1;
          emitObservation(
            {
              service: options.service,
              operation: options.operation,
              outcome: "retry",
              attempts: retries + 1,
              delayMs: Duration.toMillis(delay),
            },
            consoleLogsEnabled,
          );
          return delay;
        }),
      ),
    );

    return effect.pipe(
      Effect.timeoutFail({
        duration: Duration.millis(options.policy.timeoutMs),
        onTimeout: () =>
          new ExternalApiRequestTimeoutError({
            service: options.service,
            operation: options.operation,
            timeoutMs: options.policy.timeoutMs,
          }),
      }),
      Effect.retry(schedule),
      Effect.tap(() =>
        Effect.sync(() =>
          emitObservation(
            {
              service: options.service,
              operation: options.operation,
              outcome: "success",
              attempts: retries + 1,
              durationMs: Date.now() - startedAt,
            },
            consoleLogsEnabled,
          ),
        ),
      ),
      Effect.tapError((error) =>
        Effect.sync(() =>
          emitObservation(
            {
              service: options.service,
              operation: options.operation,
              outcome: "failure",
              attempts: retries + 1,
              durationMs: Date.now() - startedAt,
              error: formatError(error),
            },
            consoleLogsEnabled,
          ),
        ),
      ),
    );
  };
