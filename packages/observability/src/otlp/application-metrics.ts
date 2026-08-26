import * as Metric from "effect/Metric";
import { metricNames } from "../contract.ts";

const durationBoundariesMillis = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];

export const serverHttpRequests = Metric.counter(metricNames.serverHttpRequests, {
  description: "First-party HTTP requests handled by stable route, method, and outcome.",
});

export const serverHttpRequestDuration = Metric.histogram(metricNames.serverHttpRequestDuration, {
  description: "First-party HTTP request duration in milliseconds.",
  boundaries: durationBoundariesMillis,
});

export const authRequests = Metric.counter(metricNames.authRequests, {
  description: "Authentication operations by normalized operation and outcome.",
});

export const smtpDeliveries = Metric.counter(metricNames.smtpDeliveries, {
  description: "Authentication email delivery attempts by outcome.",
});

export const smtpDeliveryDuration = Metric.histogram(metricNames.smtpDeliveryDuration, {
  description: "Authentication email delivery duration in milliseconds.",
  boundaries: durationBoundariesMillis,
});

export const workerJobs = Metric.counter(metricNames.workerJobs, {
  description: "WebUntis polling jobs by bounded job, trigger, and outcome.",
});

export const workerJobDuration = Metric.histogram(metricNames.workerJobDuration, {
  description: "WebUntis polling job duration in milliseconds.",
  boundaries: durationBoundariesMillis,
});

export const workerLastSuccess = Metric.gauge(metricNames.workerLastSuccess, {
  description: "Unix timestamp of the latest successful WebUntis polling job.",
});
