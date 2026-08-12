import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";

export type ObservabilityOutcome = "success" | "failure" | "interrupt";
export type TelemetryPriority = "low" | "normal" | "high";

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

function compactAttributes(attributes: object): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
