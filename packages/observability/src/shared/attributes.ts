import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

export type ObservabilityOutcome = "success" | "failure" | "interrupt";

/**
 * Delivery priority carried on a telemetry record.
 *
 * A schema rather than a bare union because the outbox has to decode it back out of a persisted
 * snapshot. It was previously written out three times -- twice as a union and once as a schema --
 * which is three places to change when a level is added.
 */
export const TelemetryPriority = Schema.Literals(["low", "normal", "high"]);
export type TelemetryPriority = typeof TelemetryPriority.Type;

export interface SpanAttributes {
  readonly "app.operation"?: string;
  readonly "error.type"?: string;
  readonly "http.method"?: string;
  readonly "http.route"?: string;
  readonly outcome?: ObservabilityOutcome;
  readonly "screen.name"?: string;
  readonly "telemetry.priority"?: TelemetryPriority;
}

export interface MetricAttributes {
  readonly operation?: string;
  readonly outcome?: ObservabilityOutcome;
  readonly platform?: "server" | "console" | "web" | "ios" | "android";
  readonly signal?: "traces" | "logs" | "metrics" | "all";
}

export function spanAttributes(attributes: SpanAttributes): Readonly<Record<string, string>> {
  return compactAttributes(attributes);
}

export function metricAttributes(attributes: MetricAttributes): ReadonlyArray<[string, string]> {
  return Object.entries(compactAttributes(attributes));
}

export function outcomeFromExit(exit: Exit.Exit<unknown, unknown>): ObservabilityOutcome {
  if (Exit.isSuccess(exit)) {
    return "success";
  }
  return Cause.hasInterruptsOnly(exit.cause) ? "interrupt" : "failure";
}

function compactAttributes(
  attributes: SpanAttributes | MetricAttributes,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
