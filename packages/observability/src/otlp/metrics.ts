import * as Metric from "effect/Metric";
import { metricAttributes } from "../opentelemetry/attributes.ts";
import { metricNames } from "../contract.ts";

export const canaryTotal = Metric.counter(metricNames.canaryTotal, {
  description: "Successful observability canary signal sets.",
}).pipe(Metric.withAttributes(metricAttributes({ signal: "all" })));

export const canaryDuration = Metric.timer(metricNames.canaryDuration, {
  description: "Duration of the observability canary.",
});
