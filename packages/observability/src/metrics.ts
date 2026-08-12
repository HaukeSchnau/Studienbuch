import * as Metric from "effect/Metric";
import { metricAttributes } from "./attributes.ts";

export const canaryTotal = Metric.counter("studienbuch_observability_canary_total", {
  description: "Successful Studienbuch observability canary signal sets.",
}).pipe(Metric.withAttributes(metricAttributes({ signal: "all" })));

export const canaryDuration = Metric.timer("studienbuch_observability_canary_duration", {
  description: "Duration of the Studienbuch observability canary.",
});
