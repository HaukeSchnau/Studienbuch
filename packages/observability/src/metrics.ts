import * as Metric from "effect/Metric";
import { metricAttributes } from "./attributes.ts";
import { canaryMetricNames } from "./project.ts";

export const canaryTotal = Metric.counter(canaryMetricNames.total, {
  description: "Successful observability canary signal sets.",
}).pipe(Metric.withAttributes(metricAttributes({ signal: "all" })));

export const canaryDuration = Metric.timer(canaryMetricNames.duration, {
  description: "Duration of the observability canary.",
});
