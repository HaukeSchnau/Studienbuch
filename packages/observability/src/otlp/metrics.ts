import * as Metric from "effect/Metric";
import { metricAttributes } from "../shared/attributes.ts";

export const canaryTotal = Metric.counter("studienbuch_observability_canary_total", {
  description: "Successful observability canary signal sets.",
}).pipe(Metric.withAttributes(metricAttributes({ signal: "all" })));

export const canaryDuration = Metric.timer("studienbuch_observability_canary_duration", {
  description: "Duration of the observability canary.",
});
